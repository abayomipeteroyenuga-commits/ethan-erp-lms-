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
