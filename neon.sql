-- ETHAN ERP & LMS - Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor on a NEW/EMPTY project for the first production setup.

create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin','admin','instructor','student','parent');
create type public.record_status as enum ('active','inactive','archived');
create type public.payment_status as enum ('unpaid','part_paid','paid','overdue');
create type public.attendance_status as enum ('present','absent','late','excused');

create table public.profiles (
  id uuid primary key references neon_auth."user"(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  learner_type text not null default 'student',
  role public.app_role not null default 'student',
  avatar_url text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  student_no text unique not null,
  programme text,
  date_of_birth date,
  gender text,
  address text,
  registration_date date default current_date,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  instructor_no text unique not null,
  specialization text,
  joining_date date default current_date,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.parent_students (
  parent_id uuid references public.parents(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  relationship text default 'Guardian',
  primary key(parent_id, student_id)
);

create table public.course_categories (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  category_id uuid references public.course_categories(id) on delete set null,
  description text default '',
  duration text,
  fee numeric(12,2) default 0 check (fee >= 0),
  difficulty text default 'Beginner',
  image_url text,
  learning_objectives text,
  prerequisites text,
  published boolean not null default false,
  certificate_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_instructors (
  course_id uuid references public.courses(id) on delete cascade,
  instructor_id uuid references public.instructors(id) on delete cascade,
  primary key(course_id,instructor_id)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  content_html text default '',
  video_url text,
  estimated_minutes integer default 20 check (estimated_minutes > 0),
  position integer not null default 1,
  published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'active',
  unique(student_id,course_id)
);

create table public.lesson_progress (
  student_id uuid references public.students(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key(student_id,lesson_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  instructions text default '',
  max_marks numeric(8,2) default 100,
  due_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  response_text text,
  file_url text,
  submitted_at timestamptz default now(),
  score numeric(8,2),
  feedback text,
  status text default 'submitted',
  unique(assignment_id,student_id)
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete cascade,
  title text not null,
  pass_mark numeric(5,2) default 60,
  time_limit_minutes integer,
  attempts_allowed integer default 1,
  published boolean default false,
  created_at timestamptz default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  question text not null,
  question_type text not null default 'mcq',
  options jsonb,
  correct_answer jsonb,
  marks numeric(6,2) default 1
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references public.quizzes(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  score numeric(6,2),
  passed boolean,
  started_at timestamptz default now(),
  completed_at timestamptz
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  attendance_date date not null default current_date,
  status public.attendance_status not null default 'present',
  marked_by uuid references public.profiles(id) on delete set null,
  unique(student_id,course_id,attendance_date)
);

create table public.fees (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  course_id uuid references public.courses(id) on delete set null,
  amount numeric(12,2) not null check(amount >= 0),
  created_at timestamptz default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  student_id uuid references public.students(id) on delete cascade,
  amount_due numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  due_date date,
  status public.payment_status not null default 'unpaid',
  created_at timestamptz default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null,
  student_id uuid references public.students(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  description text,
  amount numeric(12,2) not null check(amount > 0),
  method text default 'bank_transfer',
  verified boolean not null default false,
  verified_by uuid references public.profiles(id) on delete set null,
  paid_at timestamptz default now(),
  created_at timestamptz default now()
);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  assessment_name text not null,
  score numeric(6,2),
  grade text,
  status text,
  published boolean default false,
  created_at timestamptz default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_no text unique not null,
  student_id uuid references public.students(id) on delete cascade,
  course_id uuid references public.courses(id) on delete cascade,
  issued_at timestamptz default now(),
  status text default 'valid',
  verification_code text unique default encode(gen_random_bytes(8),'hex')
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  audience text default 'all',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

CREATE TABLE public.course_materials (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
 title text NOT NULL DEFAULT 'Full Visual Study Manual',
 file_path text NOT NULL UNIQUE,
 file_name text NOT NULL,
 mime_type text NOT NULL DEFAULT 'application/pdf',
 uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX course_materials_course_active_idx ON public.course_materials(course_id,is_active,created_at DESC);
CREATE OR REPLACE FUNCTION public.current_role() RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT role FROM public.profiles WHERE id=auth.uid() $$;
CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT coalesce(public.current_role() IN ('super_admin','admin','instructor'),false) $$;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$ SELECT coalesce(public.current_role() IN ('super_admin','admin'),false) $$;

CREATE OR REPLACE FUNCTION public.ensure_student_account(p_first_name text,p_last_name text,p_phone text DEFAULT '',p_learner_type text DEFAULT 'student')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,neon_auth,pg_temp AS $$
DECLARE v_uid uuid:=auth.uid(); v_email text; v_role public.app_role; v_learner_type text; v_student_id uuid; v_profile public.profiles%ROWTYPE;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Please sign in to create your learner profile.'; END IF;
 SELECT email INTO v_email FROM neon_auth."user" WHERE id=v_uid;
 IF v_email IS NULL THEN RAISE EXCEPTION 'The signed-in account could not be found.'; END IF;
 v_role:=CASE WHEN lower(v_email)='fedora4jesus@gmail.com' THEN 'super_admin'::public.app_role ELSE 'student'::public.app_role END;
 v_learner_type:=CASE WHEN p_learner_type IN ('professional','business_owner') THEN p_learner_type ELSE 'student' END;
 INSERT INTO public.profiles(id,first_name,last_name,email,phone,learner_type,role)
 VALUES(v_uid,coalesce(p_first_name,''),coalesce(p_last_name,''),lower(v_email),coalesce(p_phone,''),v_learner_type,v_role)
 ON CONFLICT(id) DO UPDATE SET first_name=excluded.first_name,last_name=excluded.last_name,email=excluded.email,phone=excluded.phone,learner_type=excluded.learner_type,
 role=CASE WHEN lower(excluded.email)='fedora4jesus@gmail.com' THEN 'super_admin'::public.app_role WHEN public.profiles.role IN ('super_admin','admin','instructor') THEN public.profiles.role ELSE 'student'::public.app_role END,updated_at=now();
 SELECT * INTO v_profile FROM public.profiles WHERE id=v_uid;
 IF v_profile.role='student' THEN
   INSERT INTO public.students(user_id,student_no,status) VALUES(v_uid,'EDA-ST-'||upper(substr(replace(v_uid::text,'-',''),1,8)),'active') ON CONFLICT(user_id) DO NOTHING;
   SELECT id INTO v_student_id FROM public.students WHERE user_id=v_uid;
   INSERT INTO public.enrolments(student_id,course_id,status) SELECT v_student_id,c.id,'active' FROM public.courses c WHERE c.published=true ON CONFLICT(student_id,course_id) DO NOTHING;
 END IF;
 RETURN jsonb_build_object('id',v_profile.id,'first_name',v_profile.first_name,'last_name',v_profile.last_name,'email',v_profile.email,'phone',v_profile.phone,'learner_type',v_profile.learner_type,'role',v_profile.role,'student_id',v_student_id);
END; $$;

CREATE OR REPLACE FUNCTION public.assign_staff_role(p_email text,p_role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,neon_auth,pg_temp AS $$
DECLARE v_uid uuid; v_email text:=lower(trim(p_email)); v_name text; v_role public.app_role; v_first text; v_last text;
BEGIN
 IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only authorised administrators can manage staff accounts.'; END IF;
 IF p_role NOT IN ('admin','instructor') THEN RAISE EXCEPTION 'Only Admin or Instructor can be assigned here.'; END IF;
 IF public.current_role()='admin' AND p_role<>'instructor' THEN RAISE EXCEPTION 'Admins can create Instructor accounts only.'; END IF;
 SELECT id,name,email INTO v_uid,v_name,v_email FROM neon_auth."user" WHERE lower(email)=v_email LIMIT 1;
 IF v_uid IS NULL THEN RAISE EXCEPTION 'This person must first create a free Ethan LMS account using this email address, then you can assign the staff role.'; END IF;
 v_first:=split_part(coalesce(v_name,''),' ',1); v_last:=nullif(substr(coalesce(v_name,''),length(v_first)+2),''); v_role:=p_role::public.app_role;
 INSERT INTO public.profiles(id,first_name,last_name,email,role,learner_type) VALUES(v_uid,v_first,coalesce(v_last,''),v_email,v_role,'student')
 ON CONFLICT(id) DO UPDATE SET role=excluded.role,email=excluded.email,updated_at=now();
 IF v_role='instructor' THEN
   INSERT INTO public.instructors(user_id,instructor_no,specialization,status) VALUES(v_uid,'EDA-IN-'||upper(substr(replace(v_uid::text,'-',''),1,8)),'Assigned courses','active') ON CONFLICT(user_id) DO NOTHING;
 END IF;
 RETURN jsonb_build_object('id',v_uid,'email',v_email,'first_name',v_first,'last_name',coalesce(v_last,''),'role',v_role);
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_student_account(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_staff_role(text,text) TO authenticated;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY; ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY; ALTER TABLE public.instructors ENABLE ROW LEVEL SECURITY; ALTER TABLE public.parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_categories ENABLE ROW LEVEL SECURITY; ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY; ALTER TABLE public.course_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY; ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY; ALTER TABLE public.enrolments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY; ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY; ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY; ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY; ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY; ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY; ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY; ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY; ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile self read" ON public.profiles FOR SELECT USING(id=auth.uid() OR public.is_staff());
CREATE POLICY "profile self update" ON public.profiles FOR UPDATE USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY "public courses read" ON public.courses FOR SELECT TO authenticated USING(published=true OR public.is_staff());
CREATE POLICY "staff courses write" ON public.courses FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "public categories read" ON public.course_categories FOR SELECT TO authenticated USING(true);
CREATE POLICY "staff categories write" ON public.course_categories FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "staff students full" ON public.students FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "students read own" ON public.students FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "parent linked students read" ON public.students FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.parent_students ps JOIN public.parents p ON p.id=ps.parent_id WHERE ps.student_id=students.id AND p.user_id=auth.uid()));
CREATE POLICY "staff instructors full" ON public.instructors FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY "instructor read own" ON public.instructors FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "course instructor assignments staff read" ON public.course_instructors FOR SELECT TO authenticated USING(public.is_staff());
CREATE POLICY "course instructor assignments admin write" ON public.course_instructors FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY "staff learning structure write modules" ON public.modules FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "free published modules read" ON public.modules FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.courses c WHERE c.id=modules.course_id AND c.published=true));
CREATE POLICY "staff learning structure write lessons" ON public.lessons FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "free published lessons read" ON public.lessons FOR SELECT TO authenticated USING(public.is_staff() OR (published=true AND EXISTS(SELECT 1 FROM public.modules m JOIN public.courses c ON c.id=m.course_id WHERE m.id=lessons.module_id AND c.published=true)));
CREATE POLICY "student enrolments own read" ON public.enrolments FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid()));
CREATE POLICY "staff enrolments write" ON public.enrolments FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "student progress own" ON public.lesson_progress FOR ALL TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid())) WITH CHECK(public.is_staff() OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid()));
CREATE POLICY "free assignments read" ON public.assignments FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.published=true));
CREATE POLICY "staff assignments write" ON public.assignments FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "student submissions own read" ON public.assignment_submissions FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid()));
CREATE POLICY "student submissions own write" ON public.assignment_submissions FOR INSERT TO authenticated WITH CHECK(EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid()));
CREATE POLICY "student submissions own update" ON public.assignment_submissions FOR UPDATE TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid())) WITH CHECK(public.is_staff() OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid()));
CREATE POLICY "free quizzes read" ON public.quizzes FOR SELECT TO authenticated USING(public.is_staff() OR (published=true AND EXISTS(SELECT 1 FROM public.courses c WHERE c.id=course_id AND c.published=true)));
CREATE POLICY "staff quizzes write" ON public.quizzes FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "staff quiz questions read" ON public.quiz_questions FOR SELECT TO authenticated USING(public.is_staff());
CREATE POLICY "staff quiz questions write" ON public.quiz_questions FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "student quiz attempts own" ON public.quiz_attempts FOR ALL TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid())) WITH CHECK(public.is_staff() OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid()));
CREATE POLICY "student attendance own read" ON public.attendance FOR SELECT TO authenticated USING(public.is_staff() OR EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid()));
CREATE POLICY "staff attendance write" ON public.attendance FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "staff fees full" ON public.fees FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY "staff invoices full" ON public.invoices FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY "staff payments full" ON public.payments FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY "student payments own read" ON public.payments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid()));
CREATE POLICY "staff results full" ON public.results FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "student results own published" ON public.results FOR SELECT TO authenticated USING(published AND EXISTS(SELECT 1 FROM public.students s WHERE s.id=student_id AND s.user_id=auth.uid()));
CREATE POLICY "certificates public verification" ON public.certificates FOR SELECT USING(true);
CREATE POLICY "certificates admin write" ON public.certificates FOR ALL TO authenticated USING(public.is_admin()) WITH CHECK(public.is_admin());
CREATE POLICY "announcements read authenticated" ON public.announcements FOR SELECT TO authenticated USING(true);
CREATE POLICY "announcements staff write" ON public.announcements FOR ALL TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "notifications own" ON public.notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY "notifications own update" ON public.notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY "audit admin read" ON public.audit_logs FOR SELECT TO authenticated USING(public.is_admin());
CREATE POLICY "course materials free read" ON public.course_materials FOR SELECT TO authenticated USING(is_active=true);
CREATE POLICY "staff course materials insert" ON public.course_materials FOR INSERT TO authenticated WITH CHECK(public.is_staff());
CREATE POLICY "staff course materials update" ON public.course_materials FOR UPDATE TO authenticated USING(public.is_staff()) WITH CHECK(public.is_staff());
CREATE POLICY "staff course materials delete" ON public.course_materials FOR DELETE TO authenticated USING(public.is_staff());
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO authenticated;
REVOKE INSERT,UPDATE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(first_name,last_name,phone,learner_type,avatar_url) ON public.profiles TO authenticated;
INSERT INTO public.courses(code,title,description,duration,fee,difficulty,published,certificate_enabled) VALUES
('EDA-001','Computer Appreciation','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-002','Microsoft Word','Learn to create, format and manage professional documents for academic, office and business use.','Self-paced',0,'Beginner',true,true),
('EDA-003','Microsoft Excel','Learn practical spreadsheet skills for organizing data, calculations, analysis, reporting and everyday business work.','Self-paced',0,'Beginner',true,true),
('EDA-004','Microsoft PowerPoint','Learn to design and deliver clear, professional presentations using effective layouts, visuals and presentation tools.','Self-paced',0,'Beginner',true,true),
('EDA-005','Microsoft Access','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-006','Google Workspace','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-007','Internet & Email Skills','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-008','Typing & Keyboard Mastery','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-009','Computer Hardware Fundamentals','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-010','Computer Maintenance','Learn safe preventive maintenance, software updates, storage care, backups, performance checks, troubleshooting and maintenance planning.','Self-paced',0,'Beginner',true,true),
('EDA-011','IT Support Fundamentals','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-012','Windows Productivity','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-013','File Management & Cloud Storage','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-014','Cybersecurity Awareness','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-015','Digital Literacy','Build confident, critical and responsible digital skills for devices, online research, communication, privacy, security, content creation, cloud collaboration and AI literacy.','Self-paced',0,'Beginner',true,true),
('EDA-016','Canva Graphic Design','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-017','Advanced Canva Design','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-018','Adobe Photoshop Basics','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-019','CorelDRAW Essentials','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-020','Brand Identity Design','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-021','Social Media Graphics','Learn how to use major digital platforms professionally for communication, content, audience growth and business development.','Self-paced',0,'Beginner',true,true),
('EDA-022','Flyer & Poster Design','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-023','Logo Design Fundamentals','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-024','UI/UX Design Fundamentals','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-025','Figma for Beginners','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-026','CapCut Video Editing','Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.','Self-paced',0,'Beginner',true,true),
('EDA-027','Advanced Video Editing','Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.','Self-paced',0,'Beginner',true,true),
('EDA-028','Content Creation','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-029','Mobile Photography','Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.','Self-paced',0,'Beginner',true,true),
('EDA-030','Digital Storytelling','Develop practical media-production skills for creating engaging visual content for digital platforms and professional projects.','Self-paced',0,'Beginner',true,true),
('EDA-031','Facebook Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-032','Instagram Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-033','TikTok Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-034','YouTube Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-035','LinkedIn Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-036','WhatsApp Business Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-037','Social Media Management','Learn how to use major digital platforms professionally for communication, content, audience growth and business development.','Self-paced',0,'Beginner',true,true),
('EDA-038','Content Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-039','Email Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-040','SEO Fundamentals','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-041','Advanced SEO','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-042','Search Engine Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-043','Google Ads Fundamentals','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-044','Meta Ads Fundamentals','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-045','Marketing Analytics','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-046','Digital Marketing Strategy','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-047','Influencer Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-048','Affiliate Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-049','Personal Branding','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-050','Online Reputation Management','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-051','Artificial Intelligence Fundamentals','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-052','AI for Business','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-053','Prompt Engineering','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-054','Generative AI Tools','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-055','ChatGPT for Productivity','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-056','AI Content Creation','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-057','AI for Digital Marketing','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-058','AI for Education','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-059','AI Automation','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-060','Responsible AI','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-061','Web Design Fundamentals','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-062','HTML & CSS','Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.','Self-paced',0,'Beginner',true,true),
('EDA-063','JavaScript Fundamentals','Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.','Self-paced',0,'Beginner',true,true),
('EDA-064','WordPress Website Design','Learn to create, format and manage professional documents for academic, office and business use.','Self-paced',0,'Beginner',true,true),
('EDA-065','No-Code Website Building','Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.','Self-paced',0,'Beginner',true,true),
('EDA-066','E-commerce Website Setup','Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.','Self-paced',0,'Beginner',true,true),
('EDA-067','Landing Page Design','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-068','Web Hosting & Domains','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-069','Website SEO','Develop practical digital marketing skills for reaching audiences, promoting brands, generating leads and measuring results.','Self-paced',0,'Beginner',true,true),
('EDA-070','Website Maintenance','Understand and apply modern AI tools to improve productivity, content creation, research and digital business tasks.','Self-paced',0,'Beginner',true,true),
('EDA-071','Python for Beginners','Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.','Self-paced',0,'Beginner',true,true),
('EDA-072','JavaScript Programming','Learn the essential concepts and practical tools used to create, publish and maintain modern websites and web experiences.','Self-paced',0,'Beginner',true,true),
('EDA-073','Database Fundamentals','Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.','Self-paced',0,'Beginner',true,true),
('EDA-074','SQL Fundamentals','Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.','Self-paced',0,'Beginner',true,true),
('EDA-075','Supabase Fundamentals','Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.','Self-paced',0,'Beginner',true,true),
('EDA-076','Git & GitHub','Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.','Self-paced',0,'Beginner',true,true),
('EDA-077','Software Development Basics','Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.','Self-paced',0,'Beginner',true,true),
('EDA-078','API Fundamentals','Build foundational technical skills through clear concepts and practical exercises for modern software, data and application development.','Self-paced',0,'Beginner',true,true),
('EDA-079','Automation with No-Code Tools','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-080','App Development Fundamentals','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-081','Data Analysis Fundamentals','Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.','Self-paced',0,'Beginner',true,true),
('EDA-082','Excel Data Analysis','Learn practical spreadsheet skills for organizing data, calculations, analysis, reporting and everyday business work.','Self-paced',0,'Beginner',true,true),
('EDA-083','Power BI Fundamentals','Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.','Self-paced',0,'Beginner',true,true),
('EDA-084','Google Sheets Advanced','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-085','Data Visualization','Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.','Self-paced',0,'Beginner',true,true),
('EDA-086','Business Intelligence','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true),
('EDA-087','Basic Statistics for Data','Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.','Self-paced',0,'Beginner',true,true),
('EDA-088','Data Cleaning','Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.','Self-paced',0,'Beginner',true,true),
('EDA-089','Dashboard Design','Build practical visual design skills for creating professional digital content, graphics and user-focused creative work.','Self-paced',0,'Beginner',true,true),
('EDA-090','Reporting & Analytics','Learn how to organize, analyze, visualize and communicate data for better academic, operational and business decisions.','Self-paced',0,'Beginner',true,true),
('EDA-091','Entrepreneurship in the Digital Age','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true),
('EDA-092','Digital Business Fundamentals','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true),
('EDA-093','E-commerce Fundamentals','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true),
('EDA-094','Online Business Setup','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true),
('EDA-095','Freelancing Fundamentals','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true),
('EDA-096','Remote Work Skills','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true),
('EDA-097','Customer Relationship Management','Gain practical, easy-to-follow digital skills designed for learners, professionals and business owners seeking stronger technology confidence.','Self-paced',0,'Beginner',true,true),
('EDA-098','ERP Fundamentals','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true),
('EDA-099','CRM Fundamentals','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true),
('EDA-100','Project Management Fundamentals','Gain practical digital-business and workplace skills for managing customers, projects, operations, online services and career opportunities.','Self-paced',0,'Beginner',true,true)
ON CONFLICT(code) DO UPDATE SET title=excluded.title,description=excluded.description,duration=excluded.duration,fee=0,published=true,certificate_enabled=true,updated_at=now();


-- ETHAN LMS assessment security hardening (2026-11-09)
-- Learners may submit assignment work but cannot write marks or feedback.
-- Quiz answers are graded inside the database; clients never write score/pass flags.

REVOKE INSERT, UPDATE, DELETE ON public.assignment_submissions FROM authenticated;
GRANT INSERT (assignment_id, student_id, response_text, file_url)
  ON public.assignment_submissions TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.quiz_attempts FROM authenticated;

CREATE OR REPLACE FUNCTION public.grade_assignment_submission(
  p_submission_id uuid,
  p_score numeric,
  p_feedback text DEFAULT NULL,
  p_status text DEFAULT 'graded'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_max_marks numeric;
  v_submission public.assignment_submissions%ROWTYPE;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Only authorised staff can grade assignment submissions.';
  END IF;
  IF p_status NOT IN ('graded','returned') THEN
    RAISE EXCEPTION 'Invalid assignment grading status.';
  END IF;
  SELECT a.max_marks INTO v_max_marks
  FROM public.assignment_submissions s
  JOIN public.assignments a ON a.id=s.assignment_id
  WHERE s.id=p_submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment submission not found.';
  END IF;
  IF p_score IS NULL OR p_score < 0 OR p_score > COALESCE(v_max_marks,100) THEN
    RAISE EXCEPTION 'The score must be between zero and the assignment maximum.';
  END IF;
  UPDATE public.assignment_submissions
  SET score=p_score, feedback=p_feedback, status=p_status
  WHERE id=p_submission_id
  RETURNING * INTO v_submission;
  RETURN jsonb_build_object(
    'id',v_submission.id,
    'assignment_id',v_submission.assignment_id,
    'student_id',v_submission.student_id,
    'score',v_submission.score,
    'feedback',v_submission.feedback,
    'status',v_submission.status,
    'submitted_at',v_submission.submitted_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.grade_assignment_submission(uuid,numeric,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_assignment_submission(uuid,numeric,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_published_quiz_questions(p_quiz_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_questions jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to access this quiz.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.quizzes q
    JOIN public.courses c ON c.id=q.course_id
    WHERE q.id=p_quiz_id AND q.published=true AND c.published=true
  ) THEN
    RAISE EXCEPTION 'This quiz is not available.';
  END IF;
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id',qq.id,
        'question',qq.question,
        'question_type',qq.question_type,
        'options',qq.options,
        'marks',qq.marks
      ) ORDER BY qq.id
    ),
    '[]'::jsonb
  )
  INTO v_questions
  FROM public.quiz_questions qq
  WHERE qq.quiz_id=p_quiz_id;
  RETURN v_questions;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_published_quiz_questions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_published_quiz_questions(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_quiz_id uuid,
  p_answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_student_id uuid;
  v_pass_mark numeric;
  v_attempts_allowed integer;
  v_attempts_taken integer;
  v_total_marks numeric;
  v_earned_marks numeric;
  v_score numeric(6,2);
  v_passed boolean;
  v_attempt public.quiz_attempts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in before submitting a quiz.';
  END IF;
  IF jsonb_typeof(p_answers) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Quiz answers must be submitted as an answer object.';
  END IF;
  SELECT s.id INTO v_student_id
  FROM public.students s
  WHERE s.user_id=auth.uid();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'A learner profile is required before taking a quiz.';
  END IF;
  SELECT q.pass_mark, GREATEST(COALESCE(q.attempts_allowed,1),1), COUNT(qa.id)::integer
  INTO v_pass_mark, v_attempts_allowed, v_attempts_taken
  FROM public.quizzes q
  JOIN public.courses c ON c.id=q.course_id
  LEFT JOIN public.quiz_attempts qa
    ON qa.quiz_id=q.id AND qa.student_id=v_student_id
  WHERE q.id=p_quiz_id AND q.published=true AND c.published=true
  GROUP BY q.pass_mark,q.attempts_allowed;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This quiz is not available.';
  END IF;
  IF v_attempts_taken >= v_attempts_allowed THEN
    RAISE EXCEPTION 'You have used all allowed attempts for this quiz.';
  END IF;
  SELECT
    COALESCE(SUM(qq.marks),0),
    COALESCE(SUM(CASE WHEN (p_answers -> (qq.id::text)) = qq.correct_answer THEN qq.marks ELSE 0 END),0)
  INTO v_total_marks,v_earned_marks
  FROM public.quiz_questions qq
  WHERE qq.quiz_id=p_quiz_id;
  IF v_total_marks <= 0 THEN
    RAISE EXCEPTION 'This quiz has no graded questions yet.';
  END IF;
  v_score := ROUND((v_earned_marks / v_total_marks) * 100,2);
  v_passed := v_score >= COALESCE(v_pass_mark,60);
  INSERT INTO public.quiz_attempts(quiz_id,student_id,score,passed,started_at,completed_at)
  VALUES(p_quiz_id,v_student_id,v_score,v_passed,now(),now())
  RETURNING * INTO v_attempt;
  RETURN jsonb_build_object(
    'id',v_attempt.id,
    'quiz_id',v_attempt.quiz_id,
    'student_id',v_attempt.student_id,
    'score',v_attempt.score,
    'passed',v_attempt.passed,
    'completed_at',v_attempt.completed_at,
    'total_marks',v_total_marks,
    'earned_marks',v_earned_marks
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_quiz_attempt(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid,jsonb) TO authenticated;
