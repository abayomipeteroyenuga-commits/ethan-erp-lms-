-- ETHAN ERP: independent administration database. No LMS lesson or course-content tables.
CREATE TABLE IF NOT EXISTS public.erp_profiles (
  id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL UNIQUE,
  phone text,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin','admin','admissions','finance','hr','academic_manager','viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.erp_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_no text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  programme text,
  level text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.erp_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  department text,
  duration text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.erp_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_no text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text,
  phone text,
  department text,
  position text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.erp_finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type text NOT NULL CHECK(entry_type IN ('income','expense')),
  category text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK(amount > 0),
  reference text,
  entry_date date NOT NULL DEFAULT current_date,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','posted','void')),
  created_by uuid REFERENCES public.erp_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.erp_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no text NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES public.erp_students(id) ON DELETE RESTRICT,
  amount_due numeric(14,2) NOT NULL CHECK(amount_due >= 0),
  amount_paid numeric(14,2) NOT NULL DEFAULT 0 CHECK(amount_paid >= 0),
  due_date date,
  status text NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','overdue','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.erp_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.erp_students(id) ON DELETE CASCADE,
  class_name text NOT NULL,
  session_date date NOT NULL DEFAULT current_date,
  status text NOT NULL CHECK(status IN ('present','absent','late','excused')),
  notes text,
  marked_by uuid REFERENCES public.erp_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id,class_name,session_date)
);
CREATE TABLE IF NOT EXISTS public.erp_timetable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'class',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  location text,
  lead_name text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS public.erp_academic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.erp_students(id) ON DELETE CASCADE,
  academic_period text NOT NULL,
  course_name text NOT NULL,
  assessment_name text NOT NULL,
  score numeric(7,2) NOT NULL CHECK(score >= 0 AND score <= 100),
  grade text,
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
  created_by uuid REFERENCES public.erp_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.erp_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_no text NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES public.erp_students(id) ON DELETE RESTRICT,
  programme_name text NOT NULL,
  issued_at date NOT NULL DEFAULT current_date,
  verification_code text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  status text NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','revoked')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.erp_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  audience text NOT NULL DEFAULT 'all',
  created_by uuid REFERENCES public.erp_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.erp_audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid REFERENCES public.erp_profiles(id),
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.current_erp_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp
AS $$ SELECT role FROM public.erp_profiles WHERE id=auth.uid() $$;
CREATE OR REPLACE FUNCTION public.ensure_erp_profile(p_full_name text DEFAULT '',p_phone text DEFAULT '')
RETURNS public.erp_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_id uuid; v_email text; v_name text; v_role text;
BEGIN
 v_id:=auth.uid();
 IF v_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 v_email:=lower(coalesce(auth.jwt()->>'email',''));
 v_name:=coalesce(nullif(trim(p_full_name),''),auth.jwt()->>'name','Ethan ERP User');
 IF v_email='' THEN RAISE EXCEPTION 'Authenticated email is missing'; END IF;
 v_role:=CASE WHEN v_email='fedora4jesus@gmail.com' THEN 'super_admin' ELSE 'viewer' END;
 INSERT INTO public.erp_profiles(id,full_name,email,phone,role)
 VALUES(v_id,v_name,v_email,nullif(p_phone,''),v_role)
 ON CONFLICT(id) DO UPDATE SET full_name=CASE WHEN public.erp_profiles.full_name='' THEN EXCLUDED.full_name ELSE public.erp_profiles.full_name END;
 RETURN (SELECT p FROM public.erp_profiles p WHERE p.id=v_id);
END $$;
CREATE OR REPLACE FUNCTION public.assign_erp_role(p_user_id uuid,p_role text)
RETURNS public.erp_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v public.erp_profiles;
BEGIN
 IF public.current_erp_role() <> 'super_admin' THEN RAISE EXCEPTION 'Only Super Admin can assign ERP access roles'; END IF;
 IF p_role NOT IN ('admin','admissions','finance','hr','academic_manager','viewer') THEN RAISE EXCEPTION 'Unsupported ERP role'; END IF;
 UPDATE public.erp_profiles SET role=p_role WHERE id=p_user_id RETURNING * INTO v;
 IF v.id IS NULL THEN RAISE EXCEPTION 'ERP user not found. The user must first register.'; END IF;
 INSERT INTO public.erp_audit_logs(actor_id,action,entity,entity_id,details) VALUES(auth.uid(),'role_assigned','erp_profiles',p_user_id::text,jsonb_build_object('role',p_role));
 RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.ensure_erp_profile(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_erp_role(uuid,text) TO authenticated;

ALTER TABLE public.erp_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_finance_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_academic_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_audit_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

DROP POLICY IF EXISTS erp_profile_read ON public.erp_profiles;
CREATE POLICY erp_profile_read ON public.erp_profiles FOR SELECT TO authenticated USING(id=auth.uid() OR public.current_erp_role()='super_admin' OR public.current_erp_role()='admin' OR public.current_erp_role()='hr');
DROP POLICY IF EXISTS erp_students_read ON public.erp_students;
CREATE POLICY erp_students_read ON public.erp_students FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions','finance','academic_manager'));
DROP POLICY IF EXISTS erp_students_write ON public.erp_students;
CREATE POLICY erp_students_write ON public.erp_students FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','admissions'));
DROP POLICY IF EXISTS erp_programmes_read ON public.erp_programmes;
CREATE POLICY erp_programmes_read ON public.erp_programmes FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions','academic_manager'));
DROP POLICY IF EXISTS erp_programmes_write ON public.erp_programmes;
CREATE POLICY erp_programmes_write ON public.erp_programmes FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','academic_manager'));
DROP POLICY IF EXISTS erp_staff_read ON public.erp_staff;
CREATE POLICY erp_staff_read ON public.erp_staff FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr'));
DROP POLICY IF EXISTS erp_staff_write ON public.erp_staff;
CREATE POLICY erp_staff_write ON public.erp_staff FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr'));
DROP POLICY IF EXISTS erp_finance_read ON public.erp_finance_entries;
CREATE POLICY erp_finance_read ON public.erp_finance_entries FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_finance_write ON public.erp_finance_entries;
CREATE POLICY erp_finance_write ON public.erp_finance_entries FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_invoices_read ON public.erp_invoices;
CREATE POLICY erp_invoices_read ON public.erp_invoices FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance','admissions'));
DROP POLICY IF EXISTS erp_invoices_write ON public.erp_invoices;
CREATE POLICY erp_invoices_write ON public.erp_invoices FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance','admissions')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance','admissions'));
DROP POLICY IF EXISTS erp_attendance_read ON public.erp_attendance;
CREATE POLICY erp_attendance_read ON public.erp_attendance FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions','academic_manager'));
DROP POLICY IF EXISTS erp_attendance_write ON public.erp_attendance;
CREATE POLICY erp_attendance_write ON public.erp_attendance FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','academic_manager'));
DROP POLICY IF EXISTS erp_timetable_read ON public.erp_timetable;
CREATE POLICY erp_timetable_read ON public.erp_timetable FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager'));
DROP POLICY IF EXISTS erp_timetable_write ON public.erp_timetable;
CREATE POLICY erp_timetable_write ON public.erp_timetable FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','academic_manager'));
DROP POLICY IF EXISTS erp_academic_read ON public.erp_academic_records;
CREATE POLICY erp_academic_read ON public.erp_academic_records FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager'));
DROP POLICY IF EXISTS erp_academic_write ON public.erp_academic_records;
CREATE POLICY erp_academic_write ON public.erp_academic_records FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','academic_manager'));
DROP POLICY IF EXISTS erp_cert_read ON public.erp_certificates;
CREATE POLICY erp_cert_read ON public.erp_certificates FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager'));
DROP POLICY IF EXISTS erp_cert_write ON public.erp_certificates;
CREATE POLICY erp_cert_write ON public.erp_certificates FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','academic_manager'));
DROP POLICY IF EXISTS erp_announcements_read ON public.erp_announcements;
CREATE POLICY erp_announcements_read ON public.erp_announcements FOR SELECT TO authenticated USING(public.current_erp_role() <> 'viewer' OR public.current_erp_role()='viewer');
DROP POLICY IF EXISTS erp_announcements_write ON public.erp_announcements;
CREATE POLICY erp_announcements_write ON public.erp_announcements FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin'));
DROP POLICY IF EXISTS erp_audit_read ON public.erp_audit_logs;
CREATE POLICY erp_audit_read ON public.erp_audit_logs FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin'));


-- 2026-11-09 ERP expansion: admissions, CRM, accounting, people, procurement and operations.
CREATE TABLE IF NOT EXISTS public.erp_enquiries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), full_name text NOT NULL, email text, phone text, source text, interest text, status text NOT NULL DEFAULT 'new', next_follow_up date, notes text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_applications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_no text NOT NULL UNIQUE, full_name text NOT NULL, email text, phone text, programme text NOT NULL, intake text, submitted_at date NOT NULL DEFAULT current_date, status text NOT NULL DEFAULT 'submitted', reviewer_notes text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_type text NOT NULL DEFAULT 'individual', name text NOT NULL, company text, email text, phone text, address text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_chart_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_code text NOT NULL UNIQUE, account_name text NOT NULL, account_type text NOT NULL, parent_code text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_budgets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), period text NOT NULL, department text, category text NOT NULL, budget_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0), actual_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (actual_amount >= 0), notes text, status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_bank_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bank_name text NOT NULL, account_name text NOT NULL, account_number_masked text, currency text NOT NULL DEFAULT 'NGN', opening_balance numeric(14,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_bank_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bank_account_id uuid REFERENCES public.erp_bank_accounts(id) ON DELETE SET NULL, transaction_date date NOT NULL DEFAULT current_date, reference text, description text, debit numeric(14,2) NOT NULL DEFAULT 0, credit numeric(14,2) NOT NULL DEFAULT 0, reconciled boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), CHECK (debit >= 0 AND credit >= 0));
CREATE TABLE IF NOT EXISTS public.erp_suppliers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), supplier_name text NOT NULL, contact_name text, email text, phone text, address text, tax_id text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_purchase_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), po_number text NOT NULL UNIQUE, supplier_name text NOT NULL, order_date date NOT NULL DEFAULT current_date, expected_date date, total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(total_amount >= 0), status text NOT NULL DEFAULT 'draft', notes text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_inventory_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sku text NOT NULL UNIQUE, item_name text NOT NULL, category text, unit text NOT NULL DEFAULT 'unit', quantity_on_hand numeric(14,2) NOT NULL DEFAULT 0, reorder_level numeric(14,2) NOT NULL DEFAULT 0, unit_cost numeric(14,2) NOT NULL DEFAULT 0, location text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_inventory_movements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid REFERENCES public.erp_inventory_items(id) ON DELETE SET NULL, sku text, item_name text NOT NULL, movement_type text NOT NULL, quantity numeric(14,2) NOT NULL CHECK(quantity > 0), movement_date date NOT NULL DEFAULT current_date, reference text, notes text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_assets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_tag text NOT NULL UNIQUE, asset_name text NOT NULL, category text, purchase_date date, purchase_cost numeric(14,2) NOT NULL DEFAULT 0, location text, assigned_to text, asset_condition text NOT NULL DEFAULT 'good', status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_leave_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_no text, staff_name text NOT NULL, leave_type text NOT NULL, start_date date NOT NULL, end_date date NOT NULL, days numeric(7,2), reason text, status text NOT NULL DEFAULT 'pending', reviewed_by text, created_at timestamptz NOT NULL DEFAULT now(), CHECK(end_date >= start_date));
CREATE TABLE IF NOT EXISTS public.erp_payroll_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), period text NOT NULL UNIQUE, pay_date date, gross_total numeric(14,2) NOT NULL DEFAULT 0, deductions_total numeric(14,2) NOT NULL DEFAULT 0, net_total numeric(14,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_payroll_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid REFERENCES public.erp_payroll_runs(id) ON DELETE CASCADE, period text NOT NULL, employee_no text, staff_name text NOT NULL, basic_salary numeric(14,2) NOT NULL DEFAULT 0, allowances numeric(14,2) NOT NULL DEFAULT 0, deductions numeric(14,2) NOT NULL DEFAULT 0, net_pay numeric(14,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, category text NOT NULL, related_to text, file_url text, visibility text NOT NULL DEFAULT 'restricted', uploaded_by text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_support_tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ticket_no text NOT NULL UNIQUE, requester_name text NOT NULL, requester_email text, department text, subject text NOT NULL, priority text NOT NULL DEFAULT 'normal', status text NOT NULL DEFAULT 'open', assigned_to text, resolution text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_approval_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_type text NOT NULL, reference text, requested_by text NOT NULL, amount numeric(14,2), approver_role text, status text NOT NULL DEFAULT 'pending', decision_notes text, requested_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz);
CREATE TABLE IF NOT EXISTS public.erp_branches (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), branch_code text NOT NULL UNIQUE, branch_name text NOT NULL, address text, manager_name text, phone text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_departments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), department_code text NOT NULL UNIQUE, department_name text NOT NULL, manager_name text, cost_centre text, status text NOT NULL DEFAULT 'active', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_facility_maintenance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), asset_or_room text NOT NULL, request_type text NOT NULL, reported_by text, description text NOT NULL, priority text NOT NULL DEFAULT 'normal', assigned_to text, due_date date, status text NOT NULL DEFAULT 'open', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_sales_quotes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_no text NOT NULL UNIQUE, customer_name text NOT NULL, issue_date date NOT NULL DEFAULT current_date, valid_until date, total_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(total_amount >= 0), status text NOT NULL DEFAULT 'draft', notes text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_no text NOT NULL UNIQUE, customer_name text NOT NULL, title text NOT NULL, start_date date, end_date date, contract_value numeric(14,2) NOT NULL DEFAULT 0 CHECK(contract_value >= 0), status text NOT NULL DEFAULT 'draft', terms text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_purchase_requisitions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requisition_no text NOT NULL UNIQUE, requested_by text NOT NULL, department text, description text NOT NULL, estimated_cost numeric(14,2) NOT NULL DEFAULT 0 CHECK(estimated_cost >= 0), priority text NOT NULL DEFAULT 'normal', status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_payment_receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), receipt_no text NOT NULL UNIQUE, invoice_no text, payer_name text NOT NULL, payment_date date NOT NULL DEFAULT current_date, amount numeric(14,2) NOT NULL CHECK(amount > 0), method text NOT NULL DEFAULT 'bank transfer', reference text, status text NOT NULL DEFAULT 'recorded', created_at timestamptz NOT NULL DEFAULT now());

-- Operational module access policies. RLS is enforced by the database, not the menu alone.
ALTER TABLE public.erp_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_chart_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_facility_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_sales_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_payment_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

DROP POLICY IF EXISTS erp_enquiries_access ON public.erp_enquiries;
CREATE POLICY erp_enquiries_access ON public.erp_enquiries FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','admissions'));
DROP POLICY IF EXISTS erp_applications_access ON public.erp_applications;
CREATE POLICY erp_applications_access ON public.erp_applications FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','admissions'));
DROP POLICY IF EXISTS erp_customers_access ON public.erp_customers;
CREATE POLICY erp_customers_access ON public.erp_customers FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','admissions','finance'));
DROP POLICY IF EXISTS erp_chart_accounts_access ON public.erp_chart_accounts;
CREATE POLICY erp_chart_accounts_access ON public.erp_chart_accounts FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_budgets_access ON public.erp_budgets;
CREATE POLICY erp_budgets_access ON public.erp_budgets FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_bank_accounts_access ON public.erp_bank_accounts;
CREATE POLICY erp_bank_accounts_access ON public.erp_bank_accounts FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_bank_transactions_access ON public.erp_bank_transactions;
CREATE POLICY erp_bank_transactions_access ON public.erp_bank_transactions FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_suppliers_access ON public.erp_suppliers;
CREATE POLICY erp_suppliers_access ON public.erp_suppliers FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_purchase_orders_access ON public.erp_purchase_orders;
CREATE POLICY erp_purchase_orders_access ON public.erp_purchase_orders FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_inventory_items_access ON public.erp_inventory_items;
CREATE POLICY erp_inventory_items_access ON public.erp_inventory_items FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_inventory_movements_access ON public.erp_inventory_movements;
CREATE POLICY erp_inventory_movements_access ON public.erp_inventory_movements FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_assets_access ON public.erp_assets;
CREATE POLICY erp_assets_access ON public.erp_assets FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr','academic_manager'));
DROP POLICY IF EXISTS erp_leave_requests_access ON public.erp_leave_requests;
CREATE POLICY erp_leave_requests_access ON public.erp_leave_requests FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr'));
DROP POLICY IF EXISTS erp_payroll_runs_access ON public.erp_payroll_runs;
CREATE POLICY erp_payroll_runs_access ON public.erp_payroll_runs FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr','finance'));
DROP POLICY IF EXISTS erp_payroll_items_access ON public.erp_payroll_items;
CREATE POLICY erp_payroll_items_access ON public.erp_payroll_items FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr','finance'));
DROP POLICY IF EXISTS erp_documents_access ON public.erp_documents;
CREATE POLICY erp_documents_access ON public.erp_documents FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr','finance','admissions','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr','finance','admissions','academic_manager'));
DROP POLICY IF EXISTS erp_support_tickets_access ON public.erp_support_tickets;
CREATE POLICY erp_support_tickets_access ON public.erp_support_tickets FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr','academic_manager','admissions','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr','academic_manager','admissions','finance'));
DROP POLICY IF EXISTS erp_approval_requests_access ON public.erp_approval_requests;
CREATE POLICY erp_approval_requests_access ON public.erp_approval_requests FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr','finance','admissions','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr','finance','admissions','academic_manager'));
DROP POLICY IF EXISTS erp_branches_access ON public.erp_branches;
CREATE POLICY erp_branches_access ON public.erp_branches FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr'));
DROP POLICY IF EXISTS erp_departments_access ON public.erp_departments;
CREATE POLICY erp_departments_access ON public.erp_departments FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr'));
DROP POLICY IF EXISTS erp_facility_maintenance_access ON public.erp_facility_maintenance;
CREATE POLICY erp_facility_maintenance_access ON public.erp_facility_maintenance FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr','academic_manager'));
DROP POLICY IF EXISTS erp_sales_quotes_access ON public.erp_sales_quotes;
CREATE POLICY erp_sales_quotes_access ON public.erp_sales_quotes FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance','admissions')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance','admissions'));
DROP POLICY IF EXISTS erp_contracts_access ON public.erp_contracts;
CREATE POLICY erp_contracts_access ON public.erp_contracts FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance','admissions')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance','admissions'));
DROP POLICY IF EXISTS erp_purchase_requisitions_access ON public.erp_purchase_requisitions;
CREATE POLICY erp_purchase_requisitions_access ON public.erp_purchase_requisitions FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_payment_receipts_access ON public.erp_payment_receipts;
CREATE POLICY erp_payment_receipts_access ON public.erp_payment_receipts FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance','admissions')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance','admissions'));

CREATE INDEX IF NOT EXISTS erp_enquiries_created_at_idx ON public.erp_enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_applications_created_at_idx ON public.erp_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_customers_created_at_idx ON public.erp_customers(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_chart_accounts_created_at_idx ON public.erp_chart_accounts(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_budgets_created_at_idx ON public.erp_budgets(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_bank_accounts_created_at_idx ON public.erp_bank_accounts(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_bank_transactions_created_at_idx ON public.erp_bank_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_suppliers_created_at_idx ON public.erp_suppliers(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_purchase_orders_created_at_idx ON public.erp_purchase_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_inventory_items_created_at_idx ON public.erp_inventory_items(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_inventory_movements_created_at_idx ON public.erp_inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_assets_created_at_idx ON public.erp_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_leave_requests_created_at_idx ON public.erp_leave_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_payroll_runs_created_at_idx ON public.erp_payroll_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_payroll_items_created_at_idx ON public.erp_payroll_items(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_documents_created_at_idx ON public.erp_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_support_tickets_created_at_idx ON public.erp_support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_branches_created_at_idx ON public.erp_branches(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_departments_created_at_idx ON public.erp_departments(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_facility_maintenance_created_at_idx ON public.erp_facility_maintenance(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_sales_quotes_created_at_idx ON public.erp_sales_quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_contracts_created_at_idx ON public.erp_contracts(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_purchase_requisitions_created_at_idx ON public.erp_purchase_requisitions(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_payment_receipts_created_at_idx ON public.erp_payment_receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS erp_approval_requests_requested_at_idx ON public.erp_approval_requests(requested_at DESC);

CREATE OR REPLACE FUNCTION public.record_erp_inventory_movement(p_item_id uuid,p_type text,p_quantity numeric,p_date date DEFAULT current_date,p_reference text DEFAULT NULL,p_notes text DEFAULT NULL)
RETURNS public.erp_inventory_movements LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_item public.erp_inventory_items; v_result public.erp_inventory_movements; v_new numeric(14,2);
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance') THEN RAISE EXCEPTION 'You are not authorised to adjust inventory'; END IF;
 IF p_type NOT IN ('receipt','issue','adjustment') THEN RAISE EXCEPTION 'Invalid stock movement type'; END IF;
 IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero'; END IF;
 SELECT * INTO v_item FROM public.erp_inventory_items WHERE id=p_item_id FOR UPDATE;
 IF v_item.id IS NULL THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
 IF p_type='receipt' THEN v_new:=v_item.quantity_on_hand+p_quantity;
 ELSIF p_type='issue' THEN
  IF v_item.quantity_on_hand<p_quantity THEN RAISE EXCEPTION 'Insufficient stock. Current quantity: %',v_item.quantity_on_hand; END IF;
  v_new:=v_item.quantity_on_hand-p_quantity;
 ELSE v_new:=p_quantity;
 END IF;
 UPDATE public.erp_inventory_items SET quantity_on_hand=v_new WHERE id=p_item_id;
 INSERT INTO public.erp_inventory_movements(item_id,sku,item_name,movement_type,quantity,movement_date,reference,notes)
 VALUES(v_item.id,v_item.sku,v_item.item_name,p_type,p_quantity,coalesce(p_date,current_date),p_reference,p_notes) RETURNING * INTO v_result;
 RETURN v_result;
END $$;
GRANT EXECUTE ON FUNCTION public.record_erp_inventory_movement(uuid,text,numeric,date,text,text) TO authenticated;
