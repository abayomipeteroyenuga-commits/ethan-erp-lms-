-- ETHAN ERP/LMS v10.9 - private full-course uploads
create table if not exists public.course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null default 'Full Visual Study Manual',
  file_path text not null unique,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  uploaded_by uuid references public.profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.course_materials enable row level security;
drop policy if exists "super admin manages course materials" on public.course_materials;
create policy "super admin manages course materials" on public.course_materials for all
using (public.current_role()='super_admin'::public.app_role)
with check (public.current_role()='super_admin'::public.app_role);
drop policy if exists "staff read course materials" on public.course_materials;
create policy "staff read course materials" on public.course_materials for select using (public.is_staff());
drop policy if exists "enrolled learner reads course materials" on public.course_materials;
create policy "enrolled learner reads course materials" on public.course_materials for select using (
  exists(select 1 from public.students s join public.enrolments e on e.student_id=s.id
         where s.user_id=auth.uid() and e.course_id=course_materials.course_id and e.status='active')
);
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('course-materials','course-materials',false,52428800,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=52428800,allowed_mime_types=array['application/pdf'];
drop policy if exists "super admin uploads course pdf" on storage.objects;
create policy "super admin uploads course pdf" on storage.objects for insert to authenticated
with check (bucket_id='course-materials' and public.current_role()='super_admin'::public.app_role);
drop policy if exists "super admin manages course pdf" on storage.objects;
create policy "super admin manages course pdf" on storage.objects for all to authenticated
using (bucket_id='course-materials' and public.current_role()='super_admin'::public.app_role)
with check (bucket_id='course-materials' and public.current_role()='super_admin'::public.app_role);
drop policy if exists "authorised users read course pdf" on storage.objects;
create policy "authorised users read course pdf" on storage.objects for select to authenticated
using (
 bucket_id='course-materials' and (
   public.is_staff() or exists(
    select 1 from public.course_materials cm join public.students s on s.user_id=auth.uid()
    join public.enrolments e on e.student_id=s.id and e.course_id=cm.course_id and e.status='active'
    where cm.file_path=name and cm.is_active=true
   )
 )
);
