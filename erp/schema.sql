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
CREATE POLICY erp_inventory_items_access ON public.erp_inventory_items FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance','hr','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance','hr','academic_manager'));
DROP POLICY IF EXISTS erp_inventory_movements_access ON public.erp_inventory_movements;
CREATE POLICY erp_inventory_movements_access ON public.erp_inventory_movements FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance','hr','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance','hr','academic_manager'));
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
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance','hr','academic_manager') THEN RAISE EXCEPTION 'You are not authorised to adjust inventory'; END IF;
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


-- Receipts update invoice balances atomically. Inventory movements update stock atomically.
CREATE OR REPLACE FUNCTION public.record_erp_payment_receipt(p_receipt_no text,p_invoice_no text,p_payer_name text,p_payment_date date,p_amount numeric,p_method text,p_reference text DEFAULT NULL)
RETURNS public.erp_payment_receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invoice public.erp_invoices; v_receipt public.erp_payment_receipts; v_paid numeric(14,2);
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance','admissions') THEN RAISE EXCEPTION 'You are not authorised to record payments'; END IF;
 IF nullif(trim(p_receipt_no),'') IS NULL OR nullif(trim(p_payer_name),'') IS NULL THEN RAISE EXCEPTION 'Receipt number and payer name are required'; END IF;
 IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
 IF nullif(trim(p_invoice_no),'') IS NOT NULL THEN
  SELECT * INTO v_invoice FROM public.erp_invoices WHERE invoice_no=trim(p_invoice_no) FOR UPDATE;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  v_paid:=v_invoice.amount_paid+p_amount;
  IF v_paid>v_invoice.amount_due THEN RAISE EXCEPTION 'Payment exceeds the invoice balance'; END IF;
  UPDATE public.erp_invoices SET amount_paid=v_paid,status=CASE WHEN v_paid>=amount_due THEN 'paid' WHEN v_paid>0 THEN 'partial' ELSE 'unpaid' END WHERE id=v_invoice.id;
 END IF;
 INSERT INTO public.erp_payment_receipts(receipt_no,invoice_no,payer_name,payment_date,amount,method,reference,status)
 VALUES(trim(p_receipt_no),nullif(trim(p_invoice_no),''),trim(p_payer_name),coalesce(p_payment_date,current_date),p_amount,coalesce(nullif(trim(p_method),''),'bank transfer'),p_reference,'recorded')
 RETURNING * INTO v_receipt;
 RETURN v_receipt;
END $$;
GRANT EXECUTE ON FUNCTION public.record_erp_payment_receipt(text,text,text,date,numeric,text,text) TO authenticated;

-- Append-only operational audit trail, readable by Super Admin and Administrator.
CREATE OR REPLACE FUNCTION public.log_erp_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id text;
BEGIN
 IF TG_OP='DELETE' THEN v_id:=OLD.id::text; ELSE v_id:=NEW.id::text; END IF;
 INSERT INTO public.erp_audit_logs(actor_id,action,entity,entity_id,details)
 VALUES(auth.uid(),lower(TG_OP),TG_TABLE_NAME,v_id,jsonb_build_object('table',TG_TABLE_NAME,'operation',TG_OP));
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE INDEX IF NOT EXISTS erp_audit_logs_created_at_idx ON public.erp_audit_logs(created_at DESC);

DROP TRIGGER IF EXISTS tr_audit_erp_profiles ON public.erp_profiles;
CREATE TRIGGER tr_audit_erp_profiles AFTER INSERT OR UPDATE OR DELETE ON public.erp_profiles FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_students ON public.erp_students;
CREATE TRIGGER tr_audit_erp_students AFTER INSERT OR UPDATE OR DELETE ON public.erp_students FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_programmes ON public.erp_programmes;
CREATE TRIGGER tr_audit_erp_programmes AFTER INSERT OR UPDATE OR DELETE ON public.erp_programmes FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_staff ON public.erp_staff;
CREATE TRIGGER tr_audit_erp_staff AFTER INSERT OR UPDATE OR DELETE ON public.erp_staff FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_finance_entries ON public.erp_finance_entries;
CREATE TRIGGER tr_audit_erp_finance_entries AFTER INSERT OR UPDATE OR DELETE ON public.erp_finance_entries FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_invoices ON public.erp_invoices;
CREATE TRIGGER tr_audit_erp_invoices AFTER INSERT OR UPDATE OR DELETE ON public.erp_invoices FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_attendance ON public.erp_attendance;
CREATE TRIGGER tr_audit_erp_attendance AFTER INSERT OR UPDATE OR DELETE ON public.erp_attendance FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_timetable ON public.erp_timetable;
CREATE TRIGGER tr_audit_erp_timetable AFTER INSERT OR UPDATE OR DELETE ON public.erp_timetable FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_academic_records ON public.erp_academic_records;
CREATE TRIGGER tr_audit_erp_academic_records AFTER INSERT OR UPDATE OR DELETE ON public.erp_academic_records FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_certificates ON public.erp_certificates;
CREATE TRIGGER tr_audit_erp_certificates AFTER INSERT OR UPDATE OR DELETE ON public.erp_certificates FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_announcements ON public.erp_announcements;
CREATE TRIGGER tr_audit_erp_announcements AFTER INSERT OR UPDATE OR DELETE ON public.erp_announcements FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_enquiries ON public.erp_enquiries;
CREATE TRIGGER tr_audit_erp_enquiries AFTER INSERT OR UPDATE OR DELETE ON public.erp_enquiries FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_applications ON public.erp_applications;
CREATE TRIGGER tr_audit_erp_applications AFTER INSERT OR UPDATE OR DELETE ON public.erp_applications FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_customers ON public.erp_customers;
CREATE TRIGGER tr_audit_erp_customers AFTER INSERT OR UPDATE OR DELETE ON public.erp_customers FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_chart_accounts ON public.erp_chart_accounts;
CREATE TRIGGER tr_audit_erp_chart_accounts AFTER INSERT OR UPDATE OR DELETE ON public.erp_chart_accounts FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_budgets ON public.erp_budgets;
CREATE TRIGGER tr_audit_erp_budgets AFTER INSERT OR UPDATE OR DELETE ON public.erp_budgets FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_bank_accounts ON public.erp_bank_accounts;
CREATE TRIGGER tr_audit_erp_bank_accounts AFTER INSERT OR UPDATE OR DELETE ON public.erp_bank_accounts FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_bank_transactions ON public.erp_bank_transactions;
CREATE TRIGGER tr_audit_erp_bank_transactions AFTER INSERT OR UPDATE OR DELETE ON public.erp_bank_transactions FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_suppliers ON public.erp_suppliers;
CREATE TRIGGER tr_audit_erp_suppliers AFTER INSERT OR UPDATE OR DELETE ON public.erp_suppliers FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_purchase_orders ON public.erp_purchase_orders;
CREATE TRIGGER tr_audit_erp_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON public.erp_purchase_orders FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_inventory_items ON public.erp_inventory_items;
CREATE TRIGGER tr_audit_erp_inventory_items AFTER INSERT OR UPDATE OR DELETE ON public.erp_inventory_items FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_inventory_movements ON public.erp_inventory_movements;
CREATE TRIGGER tr_audit_erp_inventory_movements AFTER INSERT OR UPDATE OR DELETE ON public.erp_inventory_movements FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_assets ON public.erp_assets;
CREATE TRIGGER tr_audit_erp_assets AFTER INSERT OR UPDATE OR DELETE ON public.erp_assets FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_leave_requests ON public.erp_leave_requests;
CREATE TRIGGER tr_audit_erp_leave_requests AFTER INSERT OR UPDATE OR DELETE ON public.erp_leave_requests FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_payroll_runs ON public.erp_payroll_runs;
CREATE TRIGGER tr_audit_erp_payroll_runs AFTER INSERT OR UPDATE OR DELETE ON public.erp_payroll_runs FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_payroll_items ON public.erp_payroll_items;
CREATE TRIGGER tr_audit_erp_payroll_items AFTER INSERT OR UPDATE OR DELETE ON public.erp_payroll_items FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_documents ON public.erp_documents;
CREATE TRIGGER tr_audit_erp_documents AFTER INSERT OR UPDATE OR DELETE ON public.erp_documents FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_support_tickets ON public.erp_support_tickets;
CREATE TRIGGER tr_audit_erp_support_tickets AFTER INSERT OR UPDATE OR DELETE ON public.erp_support_tickets FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_approval_requests ON public.erp_approval_requests;
CREATE TRIGGER tr_audit_erp_approval_requests AFTER INSERT OR UPDATE OR DELETE ON public.erp_approval_requests FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_branches ON public.erp_branches;
CREATE TRIGGER tr_audit_erp_branches AFTER INSERT OR UPDATE OR DELETE ON public.erp_branches FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_departments ON public.erp_departments;
CREATE TRIGGER tr_audit_erp_departments AFTER INSERT OR UPDATE OR DELETE ON public.erp_departments FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_facility_maintenance ON public.erp_facility_maintenance;
CREATE TRIGGER tr_audit_erp_facility_maintenance AFTER INSERT OR UPDATE OR DELETE ON public.erp_facility_maintenance FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_sales_quotes ON public.erp_sales_quotes;
CREATE TRIGGER tr_audit_erp_sales_quotes AFTER INSERT OR UPDATE OR DELETE ON public.erp_sales_quotes FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_contracts ON public.erp_contracts;
CREATE TRIGGER tr_audit_erp_contracts AFTER INSERT OR UPDATE OR DELETE ON public.erp_contracts FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_purchase_requisitions ON public.erp_purchase_requisitions;
CREATE TRIGGER tr_audit_erp_purchase_requisitions AFTER INSERT OR UPDATE OR DELETE ON public.erp_purchase_requisitions FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_payment_receipts ON public.erp_payment_receipts;
CREATE TRIGGER tr_audit_erp_payment_receipts AFTER INSERT OR UPDATE OR DELETE ON public.erp_payment_receipts FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();


-- Admission conversion and assigned-role approval decisions.
CREATE OR REPLACE FUNCTION public.convert_erp_application(p_application_id uuid,p_admission_no text,p_level text DEFAULT NULL)
RETURNS public.erp_students LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_app public.erp_applications; v_student public.erp_students; v_full text; v_first text; v_last text;
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','admissions') THEN RAISE EXCEPTION 'You are not authorised to enrol applicants'; END IF;
 IF nullif(trim(p_admission_no),'') IS NULL THEN RAISE EXCEPTION 'Admission number is required'; END IF;
 SELECT * INTO v_app FROM public.erp_applications WHERE id=p_application_id FOR UPDATE;
 IF v_app.id IS NULL THEN RAISE EXCEPTION 'Application not found'; END IF;
 IF v_app.status<>'accepted' THEN RAISE EXCEPTION 'Only accepted applications can be converted to learners'; END IF;
 v_full:=trim(v_app.full_name); v_first:=split_part(v_full,' ',1); v_last:=trim(substr(v_full,length(v_first)+1));
 IF v_last='' THEN v_last:=v_first; END IF;
 INSERT INTO public.erp_students(admission_no,first_name,last_name,email,phone,programme,level,status)
 VALUES(trim(p_admission_no),v_first,v_last,v_app.email,v_app.phone,v_app.programme,p_level,'active') RETURNING * INTO v_student;
 UPDATE public.erp_applications SET status='enrolled' WHERE id=v_app.id;
 RETURN v_student;
END $$;
GRANT EXECUTE ON FUNCTION public.convert_erp_application(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_erp_approval(p_request_id uuid,p_decision text,p_notes text DEFAULT NULL)
RETURNS public.erp_approval_requests LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v public.erp_approval_requests; v_role text;
BEGIN
 v_role:=public.current_erp_role();
 IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
 SELECT * INTO v FROM public.erp_approval_requests WHERE id=p_request_id FOR UPDATE;
 IF v.id IS NULL THEN RAISE EXCEPTION 'Approval request not found'; END IF;
 IF v.status<>'pending' THEN RAISE EXCEPTION 'This request has already been decided'; END IF;
 IF v_role NOT IN ('super_admin','admin') AND v_role IS DISTINCT FROM v.approver_role THEN RAISE EXCEPTION 'Your role is not the assigned approver for this request'; END IF;
 UPDATE public.erp_approval_requests SET status=p_decision,decision_notes=p_notes,decided_at=now() WHERE id=p_request_id RETURNING * INTO v;
 RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_erp_approval(uuid,text,text) TO authenticated;


-- Keep payroll run totals in sync with employee payroll lines.
CREATE OR REPLACE FUNCTION public.sync_erp_payroll_run_totals() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_old uuid; v_new uuid;
BEGIN
 IF TG_OP='DELETE' THEN v_old:=OLD.run_id;
 ELSIF TG_OP='UPDATE' THEN v_old:=OLD.run_id; v_new:=NEW.run_id;
 ELSE v_new:=NEW.run_id;
 END IF;
 IF v_old IS NOT NULL AND (v_new IS NULL OR v_old<>v_new) THEN
  UPDATE public.erp_payroll_runs SET gross_total=coalesce((SELECT sum(basic_salary+allowances) FROM public.erp_payroll_items WHERE run_id=v_old),0),deductions_total=coalesce((SELECT sum(deductions) FROM public.erp_payroll_items WHERE run_id=v_old),0),net_total=coalesce((SELECT sum(net_pay) FROM public.erp_payroll_items WHERE run_id=v_old),0) WHERE id=v_old;
 END IF;
 IF v_new IS NOT NULL THEN
  UPDATE public.erp_payroll_runs SET gross_total=coalesce((SELECT sum(basic_salary+allowances) FROM public.erp_payroll_items WHERE run_id=v_new),0),deductions_total=coalesce((SELECT sum(deductions) FROM public.erp_payroll_items WHERE run_id=v_new),0),net_total=coalesce((SELECT sum(net_pay) FROM public.erp_payroll_items WHERE run_id=v_new),0) WHERE id=v_new;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS tr_sync_erp_payroll_run_totals ON public.erp_payroll_items;
CREATE TRIGGER tr_sync_erp_payroll_run_totals AFTER INSERT OR UPDATE OR DELETE ON public.erp_payroll_items FOR EACH ROW EXECUTE FUNCTION public.sync_erp_payroll_run_totals();


-- Controlled payment receipt reversal; restores the linked invoice balance.
ALTER TABLE public.erp_payment_receipts ADD COLUMN IF NOT EXISTS reversal_reason text;
CREATE OR REPLACE FUNCTION public.reverse_erp_payment_receipt(p_receipt_id uuid,p_reason text)
RETURNS public.erp_payment_receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_receipt public.erp_payment_receipts; v_invoice public.erp_invoices; v_paid numeric(14,2);
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance') THEN RAISE EXCEPTION 'Only Finance or an administrator can reverse a payment receipt'; END IF;
 IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'A reversal reason is required'; END IF;
 SELECT * INTO v_receipt FROM public.erp_payment_receipts WHERE id=p_receipt_id FOR UPDATE;
 IF v_receipt.id IS NULL THEN RAISE EXCEPTION 'Payment receipt not found'; END IF;
 IF v_receipt.status<>'recorded' THEN RAISE EXCEPTION 'Only recorded receipts can be reversed'; END IF;
 IF nullif(trim(v_receipt.invoice_no),'') IS NOT NULL THEN
  SELECT * INTO v_invoice FROM public.erp_invoices WHERE invoice_no=v_receipt.invoice_no FOR UPDATE;
  IF v_invoice.id IS NULL THEN RAISE EXCEPTION 'Linked invoice not found'; END IF;
  v_paid:=greatest(0,v_invoice.amount_paid-v_receipt.amount);
  UPDATE public.erp_invoices SET amount_paid=v_paid,status=CASE WHEN v_paid>=amount_due THEN 'paid' WHEN v_paid>0 THEN 'partial' ELSE 'unpaid' END WHERE id=v_invoice.id;
 END IF;
 UPDATE public.erp_payment_receipts SET status='reversed',reversal_reason=trim(p_reason) WHERE id=p_receipt_id RETURNING * INTO v_receipt;
 RETURN v_receipt;
END $$;
GRANT EXECUTE ON FUNCTION public.reverse_erp_payment_receipt(uuid,text) TO authenticated;


-- Proper double-entry general ledger, trial balance and corporate accounts receivable/payable.
CREATE TABLE IF NOT EXISTS public.erp_journal_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journal_no text NOT NULL UNIQUE, entry_date date NOT NULL DEFAULT current_date, description text NOT NULL, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','void')), created_by uuid REFERENCES public.erp_profiles(id), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_journal_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journal_id uuid NOT NULL REFERENCES public.erp_journal_entries(id) ON DELETE CASCADE, account_code text NOT NULL REFERENCES public.erp_chart_accounts(account_code), description text, debit numeric(14,2) NOT NULL DEFAULT 0 CHECK(debit>=0), credit numeric(14,2) NOT NULL DEFAULT 0 CHECK(credit>=0), created_at timestamptz NOT NULL DEFAULT now(), CHECK ((debit>0 AND credit=0) OR (credit>0 AND debit=0)));
CREATE TABLE IF NOT EXISTS public.erp_customer_invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_no text NOT NULL UNIQUE, customer_name text NOT NULL, description text NOT NULL, issue_date date NOT NULL DEFAULT current_date, due_date date, subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0), tax_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(tax_amount>=0), total_amount numeric(14,2) NOT NULL CHECK(total_amount>=0), amount_paid numeric(14,2) NOT NULL DEFAULT 0 CHECK(amount_paid>=0), status text NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','overdue','cancelled')), created_at timestamptz NOT NULL DEFAULT now(), CHECK(amount_paid<=total_amount));
CREATE TABLE IF NOT EXISTS public.erp_supplier_bills (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bill_no text NOT NULL UNIQUE, supplier_name text NOT NULL, description text NOT NULL, bill_date date NOT NULL DEFAULT current_date, due_date date, subtotal numeric(14,2) NOT NULL DEFAULT 0 CHECK(subtotal>=0), tax_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK(tax_amount>=0), total_amount numeric(14,2) NOT NULL CHECK(total_amount>=0), amount_paid numeric(14,2) NOT NULL DEFAULT 0 CHECK(amount_paid>=0), status text NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','overdue','cancelled')), created_at timestamptz NOT NULL DEFAULT now(), CHECK(amount_paid<=total_amount));
ALTER TABLE public.erp_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_supplier_bills ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.erp_journal_entries,public.erp_journal_lines,public.erp_customer_invoices,public.erp_supplier_bills TO authenticated;
DROP POLICY IF EXISTS erp_journal_entries_access ON public.erp_journal_entries;
CREATE POLICY erp_journal_entries_access ON public.erp_journal_entries FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_journal_lines_access ON public.erp_journal_lines;
CREATE POLICY erp_journal_lines_access ON public.erp_journal_lines FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
DROP POLICY IF EXISTS erp_customer_invoices_access ON public.erp_customer_invoices;
CREATE POLICY erp_customer_invoices_access ON public.erp_customer_invoices FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance','admissions')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance','admissions'));
DROP POLICY IF EXISTS erp_supplier_bills_access ON public.erp_supplier_bills;
CREATE POLICY erp_supplier_bills_access ON public.erp_supplier_bills FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
CREATE INDEX IF NOT EXISTS erp_journal_entries_date_idx ON public.erp_journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS erp_journal_lines_account_idx ON public.erp_journal_lines(account_code);
CREATE INDEX IF NOT EXISTS erp_customer_invoices_date_idx ON public.erp_customer_invoices(issue_date DESC);
CREATE INDEX IF NOT EXISTS erp_supplier_bills_date_idx ON public.erp_supplier_bills(bill_date DESC);
CREATE OR REPLACE VIEW public.erp_trial_balance WITH (security_invoker=true) AS
 SELECT a.account_code,a.account_name,a.account_type,
 coalesce(sum(CASE WHEN j.id IS NOT NULL THEN l.debit ELSE 0 END),0)::numeric(14,2) AS total_debits,
 coalesce(sum(CASE WHEN j.id IS NOT NULL THEN l.credit ELSE 0 END),0)::numeric(14,2) AS total_credits,
 (CASE WHEN a.account_type IN ('asset','expense') THEN coalesce(sum(CASE WHEN j.id IS NOT NULL THEN l.debit-l.credit ELSE 0 END),0) ELSE coalesce(sum(CASE WHEN j.id IS NOT NULL THEN l.credit-l.debit ELSE 0 END),0) END)::numeric(14,2) AS balance
 FROM public.erp_chart_accounts a
 LEFT JOIN public.erp_journal_lines l ON l.account_code=a.account_code
 LEFT JOIN public.erp_journal_entries j ON j.id=l.journal_id AND j.status='posted'
 GROUP BY a.account_code,a.account_name,a.account_type;
GRANT SELECT ON public.erp_trial_balance TO authenticated;

CREATE OR REPLACE FUNCTION public.post_erp_journal(p_journal_no text,p_entry_date date,p_description text,p_lines jsonb)
RETURNS public.erp_journal_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_entry public.erp_journal_entries; v_count integer; v_debits numeric(14,2); v_credits numeric(14,2); v_bad integer;
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance') THEN RAISE EXCEPTION 'Only Finance or an administrator can post journal entries'; END IF;
 IF nullif(trim(p_journal_no),'') IS NULL OR nullif(trim(p_description),'') IS NULL THEN RAISE EXCEPTION 'Journal number and description are required'; END IF;
 IF jsonb_typeof(p_lines)<>'array' THEN RAISE EXCEPTION 'Journal lines must be an array'; END IF;
 SELECT count(*),coalesce(sum((x->>'debit')::numeric),0),coalesce(sum((x->>'credit')::numeric),0),
 count(*) FILTER (WHERE nullif(x->>'account_code','') IS NULL OR coalesce((x->>'debit')::numeric,0)<0 OR coalesce((x->>'credit')::numeric,0)<0 OR NOT ((coalesce((x->>'debit')::numeric,0)>0 AND coalesce((x->>'credit')::numeric,0)=0) OR (coalesce((x->>'credit')::numeric,0)>0 AND coalesce((x->>'debit')::numeric,0)=0)))
 INTO v_count,v_debits,v_credits,v_bad FROM jsonb_array_elements(p_lines) x;
 IF v_count<2 THEN RAISE EXCEPTION 'A journal needs at least two lines'; END IF;
 IF v_bad>0 THEN RAISE EXCEPTION 'Every line must have an account and exactly one positive debit or credit'; END IF;
 IF round(v_debits,2)<>round(v_credits,2) OR v_debits<=0 THEN RAISE EXCEPTION 'Journal is not balanced. Debits: %, Credits: %',v_debits,v_credits; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_lines) x LEFT JOIN public.erp_chart_accounts a ON a.account_code=x->>'account_code' AND a.status='active' WHERE a.id IS NULL) THEN RAISE EXCEPTION 'Every journal account must exist and be active in the chart of accounts'; END IF;
 INSERT INTO public.erp_journal_entries(journal_no,entry_date,description,status,created_by)
 VALUES(trim(p_journal_no),coalesce(p_entry_date,current_date),trim(p_description),'posted',auth.uid()) RETURNING * INTO v_entry;
 INSERT INTO public.erp_journal_lines(journal_id,account_code,description,debit,credit)
 SELECT v_entry.id,x->>'account_code',nullif(x->>'description',''),coalesce((x->>'debit')::numeric,0),coalesce((x->>'credit')::numeric,0) FROM jsonb_array_elements(p_lines) x;
 RETURN v_entry;
END $$;
GRANT EXECUTE ON FUNCTION public.post_erp_journal(text,date,text,jsonb) TO authenticated;

-- Payment receipt allocation supports both student invoices and corporate customer invoices.
CREATE OR REPLACE FUNCTION public.record_erp_payment_receipt(p_receipt_no text,p_invoice_no text,p_payer_name text,p_payment_date date,p_amount numeric,p_method text,p_reference text DEFAULT NULL)
RETURNS public.erp_payment_receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_invoice public.erp_invoices; v_customer_invoice public.erp_customer_invoices; v_receipt public.erp_payment_receipts; v_paid numeric(14,2);
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance','admissions') THEN RAISE EXCEPTION 'You are not authorised to record payments'; END IF;
 IF nullif(trim(p_receipt_no),'') IS NULL OR nullif(trim(p_payer_name),'') IS NULL THEN RAISE EXCEPTION 'Receipt number and payer name are required'; END IF;
 IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
 IF nullif(trim(p_invoice_no),'') IS NOT NULL THEN
  SELECT * INTO v_invoice FROM public.erp_invoices WHERE invoice_no=trim(p_invoice_no) FOR UPDATE;
  IF FOUND THEN
   v_paid:=v_invoice.amount_paid+p_amount;
   IF v_paid>v_invoice.amount_due THEN RAISE EXCEPTION 'Payment exceeds the invoice balance'; END IF;
   UPDATE public.erp_invoices SET amount_paid=v_paid,status=CASE WHEN v_paid>=amount_due THEN 'paid' WHEN v_paid>0 THEN 'partial' ELSE 'unpaid' END WHERE id=v_invoice.id;
  ELSE
   SELECT * INTO v_customer_invoice FROM public.erp_customer_invoices WHERE invoice_no=trim(p_invoice_no) FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found in student or customer billing'; END IF;
   v_paid:=v_customer_invoice.amount_paid+p_amount;
   IF v_paid>v_customer_invoice.total_amount THEN RAISE EXCEPTION 'Payment exceeds the invoice balance'; END IF;
   UPDATE public.erp_customer_invoices SET amount_paid=v_paid,status=CASE WHEN v_paid>=total_amount THEN 'paid' WHEN v_paid>0 THEN 'partial' ELSE 'unpaid' END WHERE id=v_customer_invoice.id;
  END IF;
 END IF;
 INSERT INTO public.erp_payment_receipts(receipt_no,invoice_no,payer_name,payment_date,amount,method,reference,status)
 VALUES(trim(p_receipt_no),nullif(trim(p_invoice_no),''),trim(p_payer_name),coalesce(p_payment_date,current_date),p_amount,coalesce(nullif(trim(p_method),''),'bank transfer'),p_reference,'recorded') RETURNING * INTO v_receipt;
 RETURN v_receipt;
END $$;

CREATE OR REPLACE FUNCTION public.reverse_erp_payment_receipt(p_receipt_id uuid,p_reason text)
RETURNS public.erp_payment_receipts LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_receipt public.erp_payment_receipts; v_invoice public.erp_invoices; v_customer_invoice public.erp_customer_invoices; v_paid numeric(14,2);
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance') THEN RAISE EXCEPTION 'Only Finance or an administrator can reverse a payment receipt'; END IF;
 IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'A reversal reason is required'; END IF;
 SELECT * INTO v_receipt FROM public.erp_payment_receipts WHERE id=p_receipt_id FOR UPDATE;
 IF v_receipt.id IS NULL THEN RAISE EXCEPTION 'Payment receipt not found'; END IF;
 IF v_receipt.status<>'recorded' THEN RAISE EXCEPTION 'Only recorded receipts can be reversed'; END IF;
 IF nullif(trim(v_receipt.invoice_no),'') IS NOT NULL THEN
  SELECT * INTO v_invoice FROM public.erp_invoices WHERE invoice_no=v_receipt.invoice_no FOR UPDATE;
  IF FOUND THEN
   v_paid:=greatest(0,v_invoice.amount_paid-v_receipt.amount);
   UPDATE public.erp_invoices SET amount_paid=v_paid,status=CASE WHEN v_paid>=amount_due THEN 'paid' WHEN v_paid>0 THEN 'partial' ELSE 'unpaid' END WHERE id=v_invoice.id;
  ELSE
   SELECT * INTO v_customer_invoice FROM public.erp_customer_invoices WHERE invoice_no=v_receipt.invoice_no FOR UPDATE;
   IF FOUND THEN
    v_paid:=greatest(0,v_customer_invoice.amount_paid-v_receipt.amount);
    UPDATE public.erp_customer_invoices SET amount_paid=v_paid,status=CASE WHEN v_paid>=total_amount THEN 'paid' WHEN v_paid>0 THEN 'partial' ELSE 'unpaid' END WHERE id=v_customer_invoice.id;
   END IF;
  END IF;
 END IF;
 UPDATE public.erp_payment_receipts SET status='reversed',reversal_reason=trim(p_reason) WHERE id=p_receipt_id RETURNING * INTO v_receipt;
 RETURN v_receipt;
END $$;
GRANT EXECUTE ON FUNCTION public.record_erp_payment_receipt(text,text,text,date,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_erp_payment_receipt(uuid,text) TO authenticated;

DROP TRIGGER IF EXISTS tr_audit_erp_journal_entries ON public.erp_journal_entries;
CREATE TRIGGER tr_audit_erp_journal_entries AFTER INSERT OR UPDATE OR DELETE ON public.erp_journal_entries FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_journal_lines ON public.erp_journal_lines;
CREATE TRIGGER tr_audit_erp_journal_lines AFTER INSERT OR UPDATE OR DELETE ON public.erp_journal_lines FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_customer_invoices ON public.erp_customer_invoices;
CREATE TRIGGER tr_audit_erp_customer_invoices AFTER INSERT OR UPDATE OR DELETE ON public.erp_customer_invoices FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_supplier_bills ON public.erp_supplier_bills;
CREATE TRIGGER tr_audit_erp_supplier_bills AFTER INSERT OR UPDATE OR DELETE ON public.erp_supplier_bills FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();


-- Project delivery, compliance control and incident registers.
CREATE TABLE IF NOT EXISTS public.erp_projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_no text NOT NULL UNIQUE, project_name text NOT NULL, description text, department text, project_manager text, start_date date, due_date date, budget numeric(14,2) NOT NULL DEFAULT 0 CHECK(budget>=0), status text NOT NULL DEFAULT 'planned', created_at timestamptz NOT NULL DEFAULT now(), CHECK(due_date IS NULL OR start_date IS NULL OR due_date>=start_date));
CREATE TABLE IF NOT EXISTS public.erp_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_no text NOT NULL UNIQUE, project_id uuid REFERENCES public.erp_projects(id) ON DELETE SET NULL, title text NOT NULL, description text, assigned_to text, priority text NOT NULL DEFAULT 'normal', status text NOT NULL DEFAULT 'open', start_date date, due_date date, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_compliance_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), framework text NOT NULL, control_name text NOT NULL, owner text, risk_level text NOT NULL DEFAULT 'medium', due_date date, last_review_date date, status text NOT NULL DEFAULT 'not_started', evidence_url text, notes text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), incident_no text NOT NULL UNIQUE, incident_type text NOT NULL, reported_by text NOT NULL, occurred_at timestamptz, severity text NOT NULL DEFAULT 'low', description text NOT NULL, action_taken text, status text NOT NULL DEFAULT 'reported', resolved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.erp_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_compliance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_incidents ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.erp_projects,public.erp_tasks,public.erp_compliance_items,public.erp_incidents TO authenticated;
DROP POLICY IF EXISTS erp_projects_access ON public.erp_projects;
CREATE POLICY erp_projects_access ON public.erp_projects FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','academic_manager','hr'));
DROP POLICY IF EXISTS erp_tasks_access ON public.erp_tasks;
CREATE POLICY erp_tasks_access ON public.erp_tasks FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','academic_manager','hr'));
DROP POLICY IF EXISTS erp_compliance_items_access ON public.erp_compliance_items;
CREATE POLICY erp_compliance_items_access ON public.erp_compliance_items FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr'));
DROP POLICY IF EXISTS erp_incidents_access ON public.erp_incidents;
CREATE POLICY erp_incidents_access ON public.erp_incidents FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr','academic_manager'));
CREATE INDEX IF NOT EXISTS erp_projects_due_date_idx ON public.erp_projects(due_date);
CREATE INDEX IF NOT EXISTS erp_tasks_due_date_idx ON public.erp_tasks(due_date);
CREATE INDEX IF NOT EXISTS erp_compliance_due_date_idx ON public.erp_compliance_items(due_date);
CREATE INDEX IF NOT EXISTS erp_incidents_created_at_idx ON public.erp_incidents(created_at DESC);
DROP TRIGGER IF EXISTS tr_audit_erp_projects ON public.erp_projects;
CREATE TRIGGER tr_audit_erp_projects AFTER INSERT OR UPDATE OR DELETE ON public.erp_projects FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_tasks ON public.erp_tasks;
CREATE TRIGGER tr_audit_erp_tasks AFTER INSERT OR UPDATE OR DELETE ON public.erp_tasks FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_compliance_items ON public.erp_compliance_items;
CREATE TRIGGER tr_audit_erp_compliance_items AFTER INSERT OR UPDATE OR DELETE ON public.erp_compliance_items FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_incidents ON public.erp_incidents;
CREATE TRIGGER tr_audit_erp_incidents AFTER INSERT OR UPDATE OR DELETE ON public.erp_incidents FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();


-- Posted journal entries are immutable; corrections are made using linked reversal journals.
ALTER TABLE public.erp_journal_entries ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES public.erp_journal_entries(id);
CREATE UNIQUE INDEX IF NOT EXISTS erp_journal_entries_one_reversal_idx ON public.erp_journal_entries(reversal_of) WHERE reversal_of IS NOT NULL;
CREATE OR REPLACE FUNCTION public.reverse_erp_journal(p_journal_id uuid,p_reversal_no text,p_reversal_date date,p_reason text)
RETURNS public.erp_journal_entries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_original public.erp_journal_entries; v_reversal public.erp_journal_entries;
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance') THEN RAISE EXCEPTION 'Only Finance or an administrator can reverse journals'; END IF;
 IF nullif(trim(p_reversal_no),'') IS NULL OR nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Reversal journal number and reason are required'; END IF;
 SELECT * INTO v_original FROM public.erp_journal_entries WHERE id=p_journal_id FOR UPDATE;
 IF v_original.id IS NULL THEN RAISE EXCEPTION 'Journal entry not found'; END IF;
 IF v_original.status<>'posted' THEN RAISE EXCEPTION 'Only posted journals can be reversed'; END IF;
 IF v_original.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'A reversal journal cannot itself be reversed'; END IF;
 IF EXISTS(SELECT 1 FROM public.erp_journal_entries WHERE reversal_of=v_original.id) THEN RAISE EXCEPTION 'This journal has already been reversed'; END IF;
 INSERT INTO public.erp_journal_entries(journal_no,entry_date,description,status,created_by,reversal_of)
 VALUES(trim(p_reversal_no),coalesce(p_reversal_date,current_date),'Reversal of '||v_original.journal_no||': '||trim(p_reason),'posted',auth.uid(),v_original.id)
 RETURNING * INTO v_reversal;
 INSERT INTO public.erp_journal_lines(journal_id,account_code,description,debit,credit)
 SELECT v_reversal.id,account_code,'Reversal: '||coalesce(description,''),credit,debit FROM public.erp_journal_lines WHERE journal_id=v_original.id;
 RETURN v_reversal;
END $$;
GRANT EXECUTE ON FUNCTION public.reverse_erp_journal(uuid,text,date,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_posted_erp_journal() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE v_journal_id uuid; v_status text;
BEGIN
 IF TG_TABLE_NAME='erp_journal_entries' THEN
  IF OLD.status='posted' THEN RAISE EXCEPTION 'Posted journals are immutable. Create a reversal journal instead.'; END IF;
 ELSE
  v_journal_id:=CASE WHEN TG_OP='DELETE' THEN OLD.journal_id ELSE NEW.journal_id END;
  SELECT status INTO v_status FROM public.erp_journal_entries WHERE id=v_journal_id;
  IF v_status='posted' THEN RAISE EXCEPTION 'Posted journal lines are immutable. Create a reversal journal instead.'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS tr_guard_posted_erp_journal ON public.erp_journal_entries;
CREATE TRIGGER tr_guard_posted_erp_journal BEFORE UPDATE OR DELETE ON public.erp_journal_entries FOR EACH ROW EXECUTE FUNCTION public.guard_posted_erp_journal();
DROP TRIGGER IF EXISTS tr_guard_posted_erp_journal_line ON public.erp_journal_lines;
CREATE TRIGGER tr_guard_posted_erp_journal_line BEFORE UPDATE OR DELETE ON public.erp_journal_lines FOR EACH ROW EXECUTE FUNCTION public.guard_posted_erp_journal();


-- Expanded academy-specific learner, guardian, staff and programme records.
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS guardian_name text;
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS guardian_email text;
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS guardian_phone text;
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS enrollment_date date NOT NULL DEFAULT current_date;
ALTER TABLE public.erp_students ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.erp_branches(id) ON DELETE SET NULL;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS employment_type text;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS date_joined date;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS next_of_kin text;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS next_of_kin_phone text;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS base_salary numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS account_name text;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS account_number_masked text;
ALTER TABLE public.erp_staff ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.erp_branches(id) ON DELETE SET NULL;
ALTER TABLE public.erp_programmes ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.erp_programmes ADD COLUMN IF NOT EXISTS programme_type text;
ALTER TABLE public.erp_programmes ADD COLUMN IF NOT EXISTS fee_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.erp_programmes ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';
ALTER TABLE public.erp_programmes ADD COLUMN IF NOT EXISTS delivery_mode text;
ALTER TABLE public.erp_programmes ADD COLUMN IF NOT EXISTS capacity integer;
DROP POLICY IF EXISTS erp_programmes_read ON public.erp_programmes;
CREATE POLICY erp_programmes_read ON public.erp_programmes FOR SELECT TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions','academic_manager','finance'));

CREATE TABLE IF NOT EXISTS public.erp_student_enrolments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), enrollment_no text NOT NULL UNIQUE, student_id uuid NOT NULL REFERENCES public.erp_students(id) ON DELETE CASCADE, programme_code text REFERENCES public.erp_programmes(code) ON DELETE SET NULL, programme_name text NOT NULL, intake text, cohort text, start_date date NOT NULL DEFAULT current_date, expected_completion_date date, completion_date date, fee_amount numeric(14,2) NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'active', notes text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_student_cases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_no text NOT NULL UNIQUE, student_id uuid NOT NULL REFERENCES public.erp_students(id) ON DELETE CASCADE, case_type text NOT NULL, incident_date date NOT NULL DEFAULT current_date, severity text NOT NULL DEFAULT 'low', description text NOT NULL, action_taken text, assigned_to text, status text NOT NULL DEFAULT 'open', resolved_at date, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.erp_student_enrolments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_student_cases ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.erp_student_enrolments,public.erp_student_cases TO authenticated;
DROP POLICY IF EXISTS erp_student_enrolments_access ON public.erp_student_enrolments;
CREATE POLICY erp_student_enrolments_access ON public.erp_student_enrolments FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions','academic_manager','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','admissions','academic_manager','finance'));
DROP POLICY IF EXISTS erp_student_cases_access ON public.erp_student_cases;
CREATE POLICY erp_student_cases_access ON public.erp_student_cases FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','academic_manager','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','academic_manager','hr'));
CREATE INDEX IF NOT EXISTS erp_student_enrolments_student_idx ON public.erp_student_enrolments(student_id,created_at DESC);
CREATE INDEX IF NOT EXISTS erp_student_cases_student_idx ON public.erp_student_cases(student_id,incident_date DESC);
DROP TRIGGER IF EXISTS tr_audit_erp_student_enrolments ON public.erp_student_enrolments;
CREATE TRIGGER tr_audit_erp_student_enrolments AFTER INSERT OR UPDATE OR DELETE ON public.erp_student_enrolments FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_student_cases ON public.erp_student_cases;
CREATE TRIGGER tr_audit_erp_student_cases AFTER INSERT OR UPDATE OR DELETE ON public.erp_student_cases FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();

-- A restricted minimal directory avoids giving HR access to all private student fields for case assignment.
CREATE OR REPLACE VIEW public.erp_student_case_directory AS
 SELECT id,admission_no,first_name,last_name,created_at
 FROM public.erp_students
 WHERE public.current_erp_role() IN ('super_admin','admin','academic_manager','hr');
GRANT SELECT ON public.erp_student_case_directory TO authenticated;


-- Supplier bill payments and controlled reversal.
CREATE TABLE IF NOT EXISTS public.erp_supplier_bill_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bill_id uuid NOT NULL REFERENCES public.erp_supplier_bills(id) ON DELETE RESTRICT, payment_no text NOT NULL UNIQUE, paid_date date NOT NULL DEFAULT current_date, amount numeric(14,2) NOT NULL CHECK(amount>0), method text NOT NULL DEFAULT 'bank transfer', reference text, status text NOT NULL DEFAULT 'recorded' CHECK(status IN ('recorded','reversed')), reversal_reason text, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.erp_supplier_bill_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.erp_supplier_bill_payments TO authenticated;
DROP POLICY IF EXISTS erp_supplier_bill_payments_access ON public.erp_supplier_bill_payments;
CREATE POLICY erp_supplier_bill_payments_access ON public.erp_supplier_bill_payments FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','finance')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','finance'));
CREATE INDEX IF NOT EXISTS erp_supplier_bill_payments_date_idx ON public.erp_supplier_bill_payments(paid_date DESC);
CREATE OR REPLACE FUNCTION public.record_erp_supplier_bill_payment(p_bill_id uuid,p_payment_no text,p_paid_date date,p_amount numeric,p_method text,p_reference text DEFAULT NULL)
RETURNS public.erp_supplier_bill_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_bill public.erp_supplier_bills; v_payment public.erp_supplier_bill_payments; v_paid numeric(14,2);
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance') THEN RAISE EXCEPTION 'Only Finance or an administrator can pay supplier bills'; END IF;
 IF nullif(trim(p_payment_no),'') IS NULL THEN RAISE EXCEPTION 'Payment number is required'; END IF;
 IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero'; END IF;
 SELECT * INTO v_bill FROM public.erp_supplier_bills WHERE id=p_bill_id FOR UPDATE;
 IF v_bill.id IS NULL THEN RAISE EXCEPTION 'Supplier bill not found'; END IF;
 IF v_bill.status='cancelled' THEN RAISE EXCEPTION 'A cancelled bill cannot be paid'; END IF;
 v_paid:=v_bill.amount_paid+p_amount;
 IF v_paid>v_bill.total_amount THEN RAISE EXCEPTION 'Payment exceeds the outstanding supplier bill balance'; END IF;
 UPDATE public.erp_supplier_bills SET amount_paid=v_paid,status=CASE WHEN v_paid>=total_amount THEN 'paid' WHEN v_paid>0 THEN 'partial' ELSE 'unpaid' END WHERE id=v_bill.id;
 INSERT INTO public.erp_supplier_bill_payments(bill_id,payment_no,paid_date,amount,method,reference,status)
 VALUES(p_bill_id,trim(p_payment_no),coalesce(p_paid_date,current_date),p_amount,coalesce(nullif(trim(p_method),''),'bank transfer'),p_reference,'recorded') RETURNING * INTO v_payment;
 RETURN v_payment;
END $$;
GRANT EXECUTE ON FUNCTION public.record_erp_supplier_bill_payment(uuid,text,date,numeric,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.reverse_erp_supplier_bill_payment(p_payment_id uuid,p_reason text)
RETURNS public.erp_supplier_bill_payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_payment public.erp_supplier_bill_payments; v_bill public.erp_supplier_bills; v_paid numeric(14,2);
BEGIN
 IF public.current_erp_role() NOT IN ('super_admin','admin','finance') THEN RAISE EXCEPTION 'Only Finance or an administrator can reverse supplier payments'; END IF;
 IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'A reversal reason is required'; END IF;
 SELECT * INTO v_payment FROM public.erp_supplier_bill_payments WHERE id=p_payment_id FOR UPDATE;
 IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Supplier payment not found'; END IF;
 IF v_payment.status<>'recorded' THEN RAISE EXCEPTION 'Only recorded supplier payments can be reversed'; END IF;
 SELECT * INTO v_bill FROM public.erp_supplier_bills WHERE id=v_payment.bill_id FOR UPDATE;
 IF v_bill.id IS NULL THEN RAISE EXCEPTION 'Supplier bill not found'; END IF;
 v_paid:=greatest(0,v_bill.amount_paid-v_payment.amount);
 UPDATE public.erp_supplier_bills SET amount_paid=v_paid,status=CASE WHEN v_paid>=total_amount THEN 'paid' WHEN v_paid>0 THEN 'partial' ELSE 'unpaid' END WHERE id=v_bill.id;
 UPDATE public.erp_supplier_bill_payments SET status='reversed',reversal_reason=trim(p_reason) WHERE id=p_payment_id RETURNING * INTO v_payment;
 RETURN v_payment;
END $$;
GRANT EXECUTE ON FUNCTION public.reverse_erp_supplier_bill_payment(uuid,text) TO authenticated;
DROP TRIGGER IF EXISTS tr_audit_erp_supplier_bill_payments ON public.erp_supplier_bill_payments;
CREATE TRIGGER tr_audit_erp_supplier_bill_payments AFTER INSERT OR UPDATE OR DELETE ON public.erp_supplier_bill_payments FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();


-- Staff timekeeping, performance development and alumni engagement.
CREATE TABLE IF NOT EXISTS public.erp_staff_attendance (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), staff_id uuid NOT NULL REFERENCES public.erp_staff(id) ON DELETE CASCADE, attendance_date date NOT NULL DEFAULT current_date, clock_in time, clock_out time, attendance_status text NOT NULL DEFAULT 'present', notes text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(staff_id,attendance_date), CHECK(clock_out IS NULL OR clock_in IS NULL OR clock_out>=clock_in));
CREATE TABLE IF NOT EXISTS public.erp_staff_reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_no text NOT NULL UNIQUE, staff_id uuid NOT NULL REFERENCES public.erp_staff(id) ON DELETE CASCADE, review_period text NOT NULL, reviewer text NOT NULL, review_date date NOT NULL DEFAULT current_date, rating text NOT NULL DEFAULT 'satisfactory', score numeric(5,2), strengths text, improvement_areas text, development_plan text, status text NOT NULL DEFAULT 'draft', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_staff_training_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), training_no text NOT NULL UNIQUE, staff_id uuid NOT NULL REFERENCES public.erp_staff(id) ON DELETE CASCADE, course_name text NOT NULL, provider text, start_date date, end_date date, cost numeric(14,2) NOT NULL DEFAULT 0, certificate_url text, status text NOT NULL DEFAULT 'planned', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS public.erp_alumni (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL UNIQUE REFERENCES public.erp_students(id) ON DELETE CASCADE, graduation_date date, programme_name text, qualification text, current_employer text, job_title text, email text, phone text, employment_status text DEFAULT 'unknown', contact_opt_in boolean NOT NULL DEFAULT false, notes text, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.erp_staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_staff_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_staff_training_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_alumni ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.erp_staff_attendance,public.erp_staff_reviews,public.erp_staff_training_records,public.erp_alumni TO authenticated;
DROP POLICY IF EXISTS erp_staff_attendance_access ON public.erp_staff_attendance;
CREATE POLICY erp_staff_attendance_access ON public.erp_staff_attendance FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr'));
DROP POLICY IF EXISTS erp_staff_reviews_access ON public.erp_staff_reviews;
CREATE POLICY erp_staff_reviews_access ON public.erp_staff_reviews FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr'));
DROP POLICY IF EXISTS erp_staff_training_records_access ON public.erp_staff_training_records;
CREATE POLICY erp_staff_training_records_access ON public.erp_staff_training_records FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','hr')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','hr'));
DROP POLICY IF EXISTS erp_alumni_access ON public.erp_alumni;
CREATE POLICY erp_alumni_access ON public.erp_alumni FOR ALL TO authenticated USING(public.current_erp_role() IN ('super_admin','admin','admissions','academic_manager')) WITH CHECK(public.current_erp_role() IN ('super_admin','admin','admissions','academic_manager'));
CREATE INDEX IF NOT EXISTS erp_staff_attendance_date_idx ON public.erp_staff_attendance(attendance_date DESC);
CREATE INDEX IF NOT EXISTS erp_staff_reviews_date_idx ON public.erp_staff_reviews(review_date DESC);
CREATE INDEX IF NOT EXISTS erp_staff_training_start_idx ON public.erp_staff_training_records(start_date DESC);
DROP TRIGGER IF EXISTS tr_audit_erp_staff_attendance ON public.erp_staff_attendance;
CREATE TRIGGER tr_audit_erp_staff_attendance AFTER INSERT OR UPDATE OR DELETE ON public.erp_staff_attendance FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_staff_reviews ON public.erp_staff_reviews;
CREATE TRIGGER tr_audit_erp_staff_reviews AFTER INSERT OR UPDATE OR DELETE ON public.erp_staff_reviews FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_staff_training_records ON public.erp_staff_training_records;
CREATE TRIGGER tr_audit_erp_staff_training_records AFTER INSERT OR UPDATE OR DELETE ON public.erp_staff_training_records FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();
DROP TRIGGER IF EXISTS tr_audit_erp_alumni ON public.erp_alumni;
CREATE TRIGGER tr_audit_erp_alumni AFTER INSERT OR UPDATE OR DELETE ON public.erp_alumni FOR EACH ROW EXECUTE FUNCTION public.log_erp_change();


-- Ethan Digital Academy starter chart of accounts (editable by Finance).
INSERT INTO public.erp_chart_accounts(account_code,account_name,account_type,status) VALUES
('1000','Cash and cash equivalents','asset','active'),
('1010','Operating bank account','asset','active'),
('1020','Petty cash','asset','active'),
('1100','Trade and student receivables','asset','active'),
('1200','Input tax recoverable','asset','active'),
('1300','Inventory and consumables','asset','active'),
('1400','Computer and office equipment','asset','active'),
('1490','Accumulated depreciation','asset','active'),
('2000','Trade payables','liability','active'),
('2100','Student fees received in advance','liability','active'),
('2200','Tax and statutory deductions payable','liability','active'),
('2300','Payroll liabilities','liability','active'),
('3000','Owner capital','equity','active'),
('3100','Retained earnings','equity','active'),
('4000','Tuition and professional training income','income','active'),
('4100','Corporate training income','income','active'),
('4200','Other operating income','income','active'),
('5000','Salaries and wages','expense','active'),
('5100','Rent and facility expenses','expense','active'),
('5200','Utilities and internet','expense','active'),
('5300','Software and subscriptions','expense','active'),
('5400','Training materials and consumables','expense','active'),
('5500','Marketing and business development','expense','active'),
('5600','Repairs and maintenance','expense','active'),
('5700','Professional and administration fees','expense','active')
ON CONFLICT(account_code) DO NOTHING;
