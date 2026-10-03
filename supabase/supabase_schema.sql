-- =========================================================
-- Student Management System — Supabase Schema (Phase 1)
-- Roles: admin, teacher, student, parent
-- Run this whole file in Supabase Dashboard -> SQL Editor -> New query
-- =========================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto";

-- ---------- 1. PROFILES (extends auth.users) ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','teacher','student','parent')) default 'student',
  full_name text,
  email text,
  phone text,
  avatar_url text,
  status text not null check (status in ('active','suspended')) default 'active',
  created_at timestamptz default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- Default role is 'student' — an admin promotes/changes roles afterward
-- (role is passed in via signup metadata, defaulting to student if absent).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'full_name',
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- 2. CLASSES / SUBJECTS ----------
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,             -- e.g. "10"
  section text not null,          -- e.g. "A"
  academic_year text not null,
  class_teacher_id uuid,          -- FK added after teachers table exists
  created_at timestamptz default now()
);

create table if not exists teachers (
  id uuid primary key references profiles(id) on delete cascade,
  employee_id text unique,
  department text,
  qualification text,
  joining_date date
);

alter table classes
  add constraint classes_class_teacher_fk
  foreign key (class_teacher_id) references teachers(id);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  class_id uuid references classes(id) on delete cascade
);

create table if not exists teacher_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid references teachers(id) on delete cascade,
  subject_id uuid references subjects(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  unique (teacher_id, subject_id, class_id)
);

-- ---------- 3. STUDENTS / PARENTS ----------
create table if not exists students (
  id uuid primary key references profiles(id) on delete cascade,
  roll_no text unique,
  class_id uuid references classes(id),
  dob date,
  gender text,
  address text,
  admission_date date default now(),
  parent_id uuid references profiles(id)
);

-- ---------- 4. ATTENDANCE ----------
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  class_id uuid references classes(id),
  subject_id uuid references subjects(id),
  date date not null default current_date,
  status text check (status in ('present','absent','late','leave')) not null,
  marked_by uuid references teachers(id),
  created_at timestamptz default now(),
  unique (student_id, subject_id, date)
);

-- ---------- 5. EXAMS / MARKS / RESULTS ----------
create table if not exists exams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_id uuid references classes(id),
  term text,
  start_date date,
  end_date date
);

create table if not exists marks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  exam_id uuid references exams(id) on delete cascade,
  subject_id uuid references subjects(id),
  marks_obtained numeric not null,
  max_marks numeric not null default 100,
  entered_by uuid references teachers(id),
  updated_at timestamptz default now(),
  unique (student_id, exam_id, subject_id)
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  exam_id uuid references exams(id) on delete cascade,
  total_marks numeric,
  percentage numeric,
  grade text,
  rank int,
  published boolean default false,
  unique (student_id, exam_id)
);

-- ---------- 6. FEES (tracking only, no payment gateway) ----------
create table if not exists fee_structure (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id),
  academic_year text,
  fee_type text not null,
  amount numeric not null,
  due_date date
);

create table if not exists fee_payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  fee_structure_id uuid references fee_structure(id),
  amount_paid numeric default 0,
  payment_date date,
  mode text,                        -- cash / cheque / UPI / bank transfer etc, recorded manually
  status text check (status in ('paid','partial','due')) default 'due',
  receipt_no text,
  recorded_by uuid references profiles(id)
);

-- ---------- 7. NOTICES / EVENTS / TIMETABLE ----------
create table if not exists notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  target_role text default 'all',        -- 'all' | 'students' | 'teachers' | 'parents'
  target_class_id uuid references classes(id),
  posted_by uuid references profiles(id),
  pinned boolean default false,
  expiry_date date,
  created_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_date date not null,
  location text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists timetable (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references classes(id) on delete cascade,
  subject_id uuid references subjects(id),
  teacher_id uuid references teachers(id),
  day_of_week int check (day_of_week between 0 and 6),
  start_time time,
  end_time time
);

-- ---------- 8. LEAVE REQUESTS / AUDIT LOG ----------
create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade,
  requester_role text,
  from_date date not null,
  to_date date not null,
  reason text,
  status text check (status in ('pending','approved','rejected')) default 'pending',
  approved_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

-- Helper: current user's role, read once per query
create or replace function public.get_my_role()
returns text
language sql stable
security definer set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- Enable RLS everywhere
alter table profiles enable row level security;
alter table classes enable row level security;
alter table teachers enable row level security;
alter table subjects enable row level security;
alter table teacher_subjects enable row level security;
alter table students enable row level security;
alter table attendance enable row level security;
alter table exams enable row level security;
alter table marks enable row level security;
alter table results enable row level security;
alter table fee_structure enable row level security;
alter table fee_payments enable row level security;
alter table notices enable row level security;
alter table events enable row level security;
alter table timetable enable row level security;
alter table leave_requests enable row level security;
alter table audit_logs enable row level security;

-- ---- profiles ----
create policy "admin full access profiles" on profiles for all
  using (is_admin()) with check (is_admin());
create policy "user reads own profile" on profiles for select
  using (id = auth.uid());
create policy "user updates own profile" on profiles for update
  using (id = auth.uid());

-- ---- classes / subjects / teacher_subjects / timetable (read: everyone signed in, write: admin) ----
create policy "admin manages classes" on classes for all using (is_admin()) with check (is_admin());
create policy "everyone reads classes" on classes for select using (auth.uid() is not null);

create policy "admin manages subjects" on subjects for all using (is_admin()) with check (is_admin());
create policy "everyone reads subjects" on subjects for select using (auth.uid() is not null);

create policy "admin manages teacher_subjects" on teacher_subjects for all using (is_admin()) with check (is_admin());
create policy "everyone reads teacher_subjects" on teacher_subjects for select using (auth.uid() is not null);

create policy "admin manages timetable" on timetable for all using (is_admin()) with check (is_admin());
create policy "everyone reads timetable" on timetable for select using (auth.uid() is not null);

-- ---- teachers ----
create policy "admin manages teachers" on teachers for all using (is_admin()) with check (is_admin());
create policy "teacher reads own row" on teachers for select using (id = auth.uid());
create policy "everyone reads teacher directory" on teachers for select using (auth.uid() is not null);

-- ---- students ----
create policy "admin manages students" on students for all using (is_admin()) with check (is_admin());
create policy "student reads own row" on students for select using (id = auth.uid());
create policy "parent reads linked child" on students for select using (parent_id = auth.uid());
create policy "teacher reads students in own class" on students for select using (
  exists (
    select 1 from teacher_subjects ts
    where ts.teacher_id = auth.uid() and ts.class_id = students.class_id
  )
);

-- ---- attendance ----
create policy "admin manages attendance" on attendance for all using (is_admin()) with check (is_admin());
create policy "teacher marks attendance own class" on attendance for insert with check (
  exists (select 1 from teacher_subjects ts where ts.teacher_id = auth.uid() and ts.class_id = attendance.class_id)
);
create policy "teacher updates attendance own class" on attendance for update using (
  exists (select 1 from teacher_subjects ts where ts.teacher_id = auth.uid() and ts.class_id = attendance.class_id)
);
create policy "student reads own attendance" on attendance for select using (student_id = auth.uid());
create policy "parent reads child attendance" on attendance for select using (
  exists (select 1 from students s where s.id = attendance.student_id and s.parent_id = auth.uid())
);
create policy "teacher reads own class attendance" on attendance for select using (
  exists (select 1 from teacher_subjects ts where ts.teacher_id = auth.uid() and ts.class_id = attendance.class_id)
);

-- ---- exams ----
create policy "admin manages exams" on exams for all using (is_admin()) with check (is_admin());
create policy "everyone reads exams" on exams for select using (auth.uid() is not null);

-- ---- marks ----
create policy "admin manages marks" on marks for all using (is_admin()) with check (is_admin());
create policy "teacher enters marks own subject" on marks for insert with check (
  exists (select 1 from teacher_subjects ts where ts.teacher_id = auth.uid() and ts.subject_id = marks.subject_id)
);
create policy "teacher updates marks own subject" on marks for update using (
  exists (select 1 from teacher_subjects ts where ts.teacher_id = auth.uid() and ts.subject_id = marks.subject_id)
);
create policy "student reads own marks" on marks for select using (student_id = auth.uid());
create policy "parent reads child marks" on marks for select using (
  exists (select 1 from students s where s.id = marks.student_id and s.parent_id = auth.uid())
);
create policy "teacher reads own subject marks" on marks for select using (
  exists (select 1 from teacher_subjects ts where ts.teacher_id = auth.uid() and ts.subject_id = marks.subject_id)
);

-- ---- results ----
create policy "admin manages results" on results for all using (is_admin()) with check (is_admin());
create policy "student reads own published result" on results for select using (
  student_id = auth.uid() and published = true
);
create policy "parent reads child published result" on results for select using (
  published = true and exists (select 1 from students s where s.id = results.student_id and s.parent_id = auth.uid())
);

-- ---- fee_structure ----
create policy "admin manages fee_structure" on fee_structure for all using (is_admin()) with check (is_admin());
create policy "everyone reads fee_structure" on fee_structure for select using (auth.uid() is not null);

-- ---- fee_payments ----
create policy "admin manages fee_payments" on fee_payments for all using (is_admin()) with check (is_admin());
create policy "student reads own fee_payments" on fee_payments for select using (student_id = auth.uid());
create policy "parent reads child fee_payments" on fee_payments for select using (
  exists (select 1 from students s where s.id = fee_payments.student_id and s.parent_id = auth.uid())
);

-- ---- notices ----
create policy "admin manages notices" on notices for all using (is_admin()) with check (is_admin());
create policy "teacher posts notices own class" on notices for insert with check (
  get_my_role() = 'teacher' and (
    target_class_id is null or
    exists (select 1 from teacher_subjects ts where ts.teacher_id = auth.uid() and ts.class_id = notices.target_class_id)
  )
);
create policy "everyone reads notices" on notices for select using (auth.uid() is not null);

-- ---- events ----
create policy "admin manages events" on events for all using (is_admin()) with check (is_admin());
create policy "teacher creates events" on events for insert with check (get_my_role() = 'teacher');
create policy "everyone reads events" on events for select using (auth.uid() is not null);

-- ---- leave_requests ----
create policy "user creates own leave request" on leave_requests for insert with check (requester_id = auth.uid());
create policy "user reads own leave requests" on leave_requests for select using (requester_id = auth.uid());
create policy "admin manages all leave requests" on leave_requests for all using (is_admin()) with check (is_admin());
create policy "teacher approves student leave" on leave_requests for update using (
  get_my_role() = 'teacher' and requester_role = 'student'
);

-- ---- audit_logs ----
create policy "admin reads audit_logs" on audit_logs for select using (is_admin());
create policy "system inserts audit_logs" on audit_logs for insert with check (auth.uid() is not null);

-- =========================================================
-- End of schema. Next: Storage buckets (avatars, documents,
-- receipts) via Dashboard -> Storage, then wire up
-- @supabase/supabase-js in the React app.
-- =========================================================
