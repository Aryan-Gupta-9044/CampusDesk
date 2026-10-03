-- ============================================================
-- CampusDesk — Feature additions patch
-- Run this once in SQL Editor (after your existing schema).
-- ============================================================

-- ---------- 1. Fee payment requests (student/parent submit, admin verifies) ----------
-- Widen the allowed status values so a submitted-but-unverified payment
-- has its own state, distinct from admin-confirmed paid/partial/due.
alter table fee_payments drop constraint if exists fee_payments_status_check;
alter table fee_payments add constraint fee_payments_status_check
  check (status in ('paid','partial','due','pending_verification','rejected'));

-- Let a student submit a payment claim for themselves.
create policy "student submits own payment request"
on fee_payments for insert
with check (student_id = auth.uid() and status = 'pending_verification');

-- Let a parent submit a payment claim for their linked child.
create policy "parent submits child payment request"
on fee_payments for insert
with check (
  status = 'pending_verification'
  and exists (select 1 from students s where s.id = fee_payments.student_id and s.parent_id = auth.uid())
);

-- ---------- 2. Teacher-managed timetable ----------
-- Admin already has full access. This lets a teacher manage (add/edit/
-- delete) timetable entries, but only for their own class+subject
-- assignments — checked against teacher_subjects, not just self-claimed.
create policy "teacher manages own timetable entries"
on timetable for all
using (teacher_id = auth.uid())
with check (
  teacher_id = auth.uid()
  and exists (
    select 1 from teacher_subjects ts
    where ts.teacher_id = auth.uid()
      and ts.class_id = timetable.class_id
      and ts.subject_id = timetable.subject_id
  )
);

-- ---------- 3. Teacher queries / chat ----------
create table if not exists teacher_queries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  sender_id uuid references profiles(id),
  sender_role text,
  teacher_id uuid references teachers(id),
  query_type text,
  message text not null,
  reply text,
  status text check (status in ('open','answered')) default 'open',
  created_at timestamptz default now(),
  replied_at timestamptz
);

alter table teacher_queries enable row level security;

create policy "sender inserts own query" on teacher_queries for insert
  with check (sender_id = auth.uid());
create policy "sender reads own query" on teacher_queries for select
  using (sender_id = auth.uid());
create policy "teacher reads queries addressed to them" on teacher_queries for select
  using (teacher_id = auth.uid());
create policy "teacher replies to their queries" on teacher_queries for update
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "admin full access queries" on teacher_queries for all
  using (is_admin()) with check (is_admin());
