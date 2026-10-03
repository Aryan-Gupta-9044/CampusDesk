-- ============================================================
-- CampusDesk — Fresh Seed Data (v2)
-- ============================================================
-- Deletes the OLD dummy dataset (@campusdesk.test accounts) first,
-- then creates a smaller, complete replacement:
--   4 classes, 20 subjects, 5 teachers, 24 students, 24 parents,
--   a full 5-day timetable, 15 days of per-subject attendance,
--   3 exams per class with marks AND published results, fee
--   structures with a realistic mix of paid/partial/pending
--   payments, notices, events, and leave requests.
--
-- LOGIN FORMAT:
--   Student:  <firstname>@gmail.com          password: <Firstname>1234
--   Teacher:  <firstname>@gmail.com           password: <Firstname>1234
--   Parent:   <firstname>parent@gmail.com     password: <Firstname>1234
--   e.g. aarav@gmail.com / Aarav1234, aaravparent@gmail.com / Aarav1234
--
-- No dummy admin accounts are created — you stay the only Admin.
-- ============================================================

-- ---------- 0. Cleanup old dummy data ----------
-- Order matters: delete users first (cascades through profiles ->
-- students/teachers -> their attendance/marks/results/fee_payments/
-- leave_requests), then exams (no cascade from classes), then
-- fee_structure, then notices/events by title, then classes last
-- (cascades subjects + timetable).
delete from auth.users where email like '%@campusdesk.test';
delete from exams where class_id in (select id from classes where academic_year = '2026-27');
delete from fee_structure where academic_year = '2026-27';
delete from notices where title in (
  'Welcome to the new academic year','Parent-Teacher Meeting','Library books due'
);
delete from events where title in (
  'Annual Sports Day','Science Exhibition','Independence Day Celebration'
);
delete from classes where academic_year = '2026-27';

-- ---------- 1. Classes (4) ----------
create temporary table temp_classes (
  seq int,
  id uuid default gen_random_uuid(),
  name text,
  section text
) on commit drop;

insert into temp_classes (seq, name, section)
select * from (values (1,'10','A'),(2,'10','B'),(3,'11','A'),(4,'11','B')) as t(seq, name, section);

insert into classes (id, name, section, academic_year)
select id, name, section, '2026-27' from temp_classes;

-- ---------- 2. Subjects (5 per class = 20) ----------
create temporary table temp_subjects (
  id uuid default gen_random_uuid(),
  class_seq int,
  class_id uuid,
  name text,
  code text
) on commit drop;

insert into temp_subjects (class_seq, class_id, name, code)
select tc.seq, tc.id, s.name, s.code
from temp_classes tc
cross join (
  values ('Mathematics','MATH'),('Science','SCI'),('English','ENG'),
         ('Social Science','SST'),('Computer Science','CS')
) as s(name, code);

insert into subjects (id, class_id, name, code)
select id, class_id, name, code from temp_subjects;

-- ---------- 3. Teachers (5, one subject specialist each) ----------
create temporary table temp_teachers (
  seq int,
  id uuid default gen_random_uuid(),
  first_name text,
  full_name text,
  email text,
  subject_name text
) on commit drop;

insert into temp_teachers (seq, first_name, full_name, email, subject_name)
values
  (1,'Anita','Anita Sharma','anita@gmail.com','Mathematics'),
  (2,'Ravi','Ravi Verma','ravi@gmail.com','Science'),
  (3,'Priya','Priya Nair','priya@gmail.com','English'),
  (4,'Suresh','Suresh Iyer','suresh@gmail.com','Social Science'),
  (5,'Deepak','Deepak Joshi','deepak@gmail.com','Computer Science');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  (select instance_id from auth.users limit 1),
  id, 'authenticated', 'authenticated', email,
  crypt(first_name || '1234', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name, 'role', 'teacher'),
  now(), now(), '', '', '', ''
from temp_teachers;

insert into teachers (id, employee_id, department, qualification, joining_date)
select id, 'EMP-' || lpad(seq::text, 3, '0'), subject_name, 'M.Ed', current_date - (400 + seq*30)
from temp_teachers;

-- Teachers: all have a phone (98xxxxxx01..05)
update profiles p
set phone = '98000000' || lpad(tt.seq::text, 2, '0')
from temp_teachers tt
where p.id = tt.id;

update classes c
set class_teacher_id = tt.id
from temp_classes tc
join temp_teachers tt on tt.seq = 1 + ((tc.seq - 1) % 5)
where c.id = tc.id
  and tc.seq <> 4;  -- class 11-B deliberately has NO class teacher (tests "No class teacher assigned")

insert into teacher_subjects (teacher_id, subject_id, class_id)
select tt.id, ts.id, ts.class_id
from temp_teachers tt
join temp_subjects ts on ts.name = tt.subject_name;

-- ---------- 4. Students (24, 6 per class, all distinct first names) ----------
create temporary table temp_students (
  seq int,
  id uuid default gen_random_uuid(),
  first_name text,
  full_name text,
  email text,
  class_seq int,
  class_id uuid,
  roll_no text
) on commit drop;

insert into temp_students (seq, first_name, full_name, email, class_seq, class_id, roll_no)
select
  n, fn, fn || ' ' || ln, lower(fn) || '@gmail.com', cs, tc.id,
  tc.name || tc.section || '-' || lpad(row_number() over (partition by cs order by n)::text, 3, '0')
from generate_series(1, 24) as n
cross join lateral (
  select (array['Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan','Krishna','Ishaan',
                 'Ananya','Diya','Saanvi','Aadhya','Kiara','Myra','Anika','Navya','Riya','Prisha',
                 'Kabir','Rohan','Ira','Tara'])[n] as fn,
         (array['Sharma','Verma','Gupta','Singh','Kumar','Patel','Reddy','Nair','Iyer','Rao',
                 'Mehta','Joshi','Chauhan','Yadav','Malhotra','Bhatt','Rana','Kapoor','Desai','Menon',
                 'Pillai','Shetty','Bose','Dutta'])[n] as ln,
         1 + ((n - 1) % 4) as cs
) x
join temp_classes tc on tc.seq = cs;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  (select instance_id from auth.users limit 1),
  id, 'authenticated', 'authenticated', email,
  crypt(first_name || '1234', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name, 'role', 'student'),
  now(), now(), '', '', '', ''
from temp_students;

insert into students (id, roll_no, class_id, dob, gender, address, admission_date)
select
  id, roll_no, class_id,
  date '2010-01-01' + ((seq * 37) % 2000),
  (array['male','female'])[1 + (seq % 2)],
  (array['Lucknow','Kanpur','Varanasi','Prayagraj','Noida','Ghaziabad'])[1 + (seq % 6)],
  current_date - (200 + seq)
from temp_students;

-- Students: phone for all except every 6th (seq 6,12,18,24) to test "—"
update profiles p
set phone = '97000000' || lpad(ts.seq::text, 2, '0')
from temp_students ts
where p.id = ts.id and ts.seq % 6 <> 0;

-- ---------- 5. Parents (linked 1:1, except seq 23 and 24 who have NO parent) ----------
create temporary table temp_parents (
  seq int,
  id uuid default gen_random_uuid(),
  first_name text,
  full_name text,
  email text,
  student_id uuid
) on commit drop;

insert into temp_parents (seq, first_name, full_name, email, student_id)
select ts.seq, ts.first_name, 'Parent of ' || ts.full_name, lower(ts.first_name) || 'parent@gmail.com', ts.id
from temp_students ts
where ts.seq <= 22;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  (select instance_id from auth.users limit 1),
  id, 'authenticated', 'authenticated', email,
  crypt(first_name || '1234', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name, 'role', 'parent'),
  now(), now(), '', '', '', ''
from temp_parents;

update students s
set parent_id = tp.id
from temp_parents tp
where s.id = tp.student_id;

-- Parents: phone for all except seq 5 (to test "—")
update profiles p
set phone = '96000000' || lpad(tp.seq::text, 2, '0')
from temp_parents tp
where p.id = tp.id and tp.seq <> 5;

-- ---------- 6. Timetable (Mon-Fri, one period per subject per class) ----------
insert into timetable (class_id, subject_id, teacher_id, day_of_week, start_time, end_time)
select
  ts.class_id,
  ts.id,
  tt.id,
  slot.day_num,
  slot.start_t,
  slot.end_t
from temp_subjects ts
join temp_teachers tt on tt.subject_name = ts.name
join lateral (
  select
    case ts.name
      when 'Mathematics' then 1 when 'Science' then 2 when 'English' then 3
      when 'Social Science' then 4 when 'Computer Science' then 5
    end as day_num,
    ('08:00'::time + ((case ts.name
      when 'Mathematics' then 0 when 'Science' then 1 when 'English' then 2
      when 'Social Science' then 3 when 'Computer Science' then 4 end) * interval '1 hour')) as start_t,
    ('09:00'::time + ((case ts.name
      when 'Mathematics' then 0 when 'Science' then 1 when 'English' then 2
      when 'Social Science' then 3 when 'Computer Science' then 4 end) * interval '1 hour')) as end_t
) slot on true;

-- ---------- 7. Attendance (last 15 days, every subject) ----------
insert into attendance (student_id, class_id, subject_id, date, status, marked_by)
select
  ts.id, ts.class_id, tsub.id, d.the_date,
  case when random() < 0.85 then 'present' when random() < 0.95 then 'absent' else 'late' end,
  tt.id
from temp_students ts
join temp_subjects tsub on tsub.class_seq = ts.class_seq
join temp_teachers tt on tt.subject_name = tsub.name
cross join lateral (select current_date - g as the_date from generate_series(1, 15) as g) d
on conflict (student_id, subject_id, date) do nothing;

-- ---------- 8. Exams (3 per class) + Marks (published results too) ----------
create temporary table temp_exams (
  class_seq int,
  seq int,
  id uuid default gen_random_uuid(),
  name text,
  term text
) on commit drop;

insert into temp_exams (class_seq, seq, name, term)
select tc.seq, e.seq, e.name, e.term
from temp_classes tc
cross join (
  values (1,'Unit Test 1','Term 1'),(2,'Mid Term','Term 1'),(3,'Unit Test 2','Term 2')
) as e(seq, name, term);

insert into exams (id, name, class_id, term, start_date, end_date)
select te.id, te.name, tc.id, te.term, current_date - (60 - te.seq*15), current_date - (55 - te.seq*15)
from temp_exams te
join temp_classes tc on tc.seq = te.class_seq;

insert into marks (student_id, exam_id, subject_id, marks_obtained, max_marks, entered_by)
select ts.id, te.id, tsub.id, 35 + floor(random() * 66), 100, tt.id
from temp_students ts
join temp_classes tc on tc.id = ts.class_id
join temp_exams te on te.class_seq = tc.seq
join temp_subjects tsub on tsub.class_seq = tc.seq
join temp_teachers tt on tt.subject_name = tsub.name
on conflict (student_id, exam_id, subject_id) do nothing;

-- Compute + publish results for every exam (grade bands match the app's own logic)
insert into results (student_id, exam_id, total_marks, percentage, grade, rank, published)
select
  m.student_id, m.exam_id,
  sum(m.marks_obtained) as total_marks,
  round(sum(m.marks_obtained) / sum(m.max_marks) * 100, 1) as percentage,
  case
    when round(sum(m.marks_obtained) / sum(m.max_marks) * 100, 1) >= 90 then 'A+'
    when round(sum(m.marks_obtained) / sum(m.max_marks) * 100, 1) >= 80 then 'A'
    when round(sum(m.marks_obtained) / sum(m.max_marks) * 100, 1) >= 70 then 'B'
    when round(sum(m.marks_obtained) / sum(m.max_marks) * 100, 1) >= 60 then 'C'
    when round(sum(m.marks_obtained) / sum(m.max_marks) * 100, 1) >= 50 then 'D'
    else 'F'
  end as grade,
  rank() over (partition by m.exam_id order by sum(m.marks_obtained) desc) as rank,
  true
from marks m
group by m.student_id, m.exam_id
on conflict (student_id, exam_id) do nothing;

-- ---------- 9. Fees (with a realistic mix of statuses, including pending verification) ----------
create temporary table temp_fee_structure (
  class_seq int,
  id uuid default gen_random_uuid(),
  fee_type text,
  amount numeric
) on commit drop;

insert into temp_fee_structure (class_seq, fee_type, amount)
select seq, 'Tuition Fee', 15000 from temp_classes
union all
select seq, 'Transport Fee', 5000 from temp_classes;

insert into fee_structure (id, class_id, academic_year, fee_type, amount, due_date)
select tfs.id, tc.id, '2026-27', tfs.fee_type, tfs.amount, current_date + 30
from temp_fee_structure tfs
join temp_classes tc on tc.seq = tfs.class_seq;

-- Every 3rd student: fully paid
insert into fee_payments (student_id, fee_structure_id, amount_paid, payment_date, mode, status, receipt_no)
select ts.id, tfs.id, tfs.amount, current_date - 5, 'cash', 'paid', 'RCPT-' || lpad(ts.seq::text, 4, '0')
from temp_students ts
join temp_classes tc on tc.id = ts.class_id
join temp_fee_structure tfs on tfs.class_seq = tc.seq and tfs.fee_type = 'Tuition Fee'
where ts.seq % 3 = 0;

-- Every 3rd+1 student: partially paid (confirmed)
insert into fee_payments (student_id, fee_structure_id, amount_paid, payment_date, mode, status, receipt_no)
select ts.id, tfs.id, round(tfs.amount * 0.5), current_date - 3, 'upi', 'partial', 'RCPT-' || lpad((ts.seq+100)::text, 4, '0')
from temp_students ts
join temp_classes tc on tc.id = ts.class_id
join temp_fee_structure tfs on tfs.class_seq = tc.seq and tfs.fee_type = 'Tuition Fee'
where ts.seq % 3 = 1;

-- Every 3rd+2 student: submitted a payment awaiting admin verification (tests the new workflow)
insert into fee_payments (student_id, fee_structure_id, amount_paid, payment_date, mode, status, receipt_no)
select ts.id, tfs.id, round(tfs.amount * 0.6), current_date - 1, 'upi', 'pending_verification', 'Paid via UPI, ref #' || ts.seq
from temp_students ts
join temp_classes tc on tc.id = ts.class_id
join temp_fee_structure tfs on tfs.class_seq = tc.seq and tfs.fee_type = 'Tuition Fee'
where ts.seq % 3 = 2;

-- Seq 7: partially paid (5000 confirmed) AND a pending request of 3000
--        -> confirmed 5000, remaining 10000, pending 3000, NO Pay button.
-- Seq 8: a REJECTED payment only -> still due, rejected row never counts, Pay visible.
-- To keep these two scenarios unambiguous, remove the generic rows for seq 7 and 8 first.
delete from fee_payments
where student_id in (select id from temp_students where seq in (7, 8))
  and fee_structure_id in (select id from temp_fee_structure where fee_type = 'Tuition Fee');

insert into fee_payments (student_id, fee_structure_id, amount_paid, payment_date, mode, status, receipt_no)
select ts.id, tfs.id, 5000, current_date - 4, 'cash', 'partial', 'RCPT-0701'
from temp_students ts
join temp_classes tc on tc.id = ts.class_id
join temp_fee_structure tfs on tfs.class_seq = tc.seq and tfs.fee_type = 'Tuition Fee'
where ts.seq = 7;

insert into fee_payments (student_id, fee_structure_id, amount_paid, payment_date, mode, status, receipt_no)
select ts.id, tfs.id, 3000, current_date - 1, 'upi', 'pending_verification', 'UPI ref #7001'
from temp_students ts
join temp_classes tc on tc.id = ts.class_id
join temp_fee_structure tfs on tfs.class_seq = tc.seq and tfs.fee_type = 'Tuition Fee'
where ts.seq = 7;

insert into fee_payments (student_id, fee_structure_id, amount_paid, payment_date, mode, status, receipt_no)
select ts.id, tfs.id, 2000, current_date - 6, 'upi', 'rejected', 'Wrong transaction id'
from temp_students ts
join temp_classes tc on tc.id = ts.class_id
join temp_fee_structure tfs on tfs.class_seq = tc.seq and tfs.fee_type = 'Tuition Fee'
where ts.seq = 8;

-- Transport Fee: only student seq 9 has paid it in full; everyone else has
-- NO transport payment at all -> completely unpaid (due, Pay visible) for
-- most students, so every state is present for every class.
insert into fee_payments (student_id, fee_structure_id, amount_paid, payment_date, mode, status, receipt_no)
select ts.id, tfs.id, tfs.amount, current_date - 2, 'cash', 'paid', 'RCPT-0901'
from temp_students ts
join temp_classes tc on tc.id = ts.class_id
join temp_fee_structure tfs on tfs.class_seq = tc.seq and tfs.fee_type = 'Transport Fee'
where ts.seq = 9;

-- ---------- 10. Notices ----------
insert into notices (title, content, target_role, target_class_id, pinned, created_at)
values
  ('Welcome to the new academic year', 'Classes begin Monday. Please check your timetable.', 'all', null, true, now()),
  ('Parent-Teacher Meeting', 'PTMs will be held next Friday from 10am to 1pm.', 'all', null, false, now()),
  ('Library books due', 'Please return all borrowed library books by end of month.', 'students', null, false, now());

-- ---------- 11. Events ----------
insert into events (title, description, event_date, location)
values
  ('Annual Sports Day', 'Track and field events for all classes.', current_date + 20, 'Main Ground'),
  ('Science Exhibition', 'Student project showcase.', current_date + 35, 'Auditorium'),
  ('Independence Day Celebration', 'Flag hoisting and cultural program.', current_date + 10, 'Main Hall');

-- ---------- 12. Leave requests (mixed statuses) ----------
insert into leave_requests (requester_id, requester_role, from_date, to_date, reason, status)
select ts.id, 'student', current_date + 2, current_date + 3, 'Family function', 'pending'
from temp_students ts where ts.seq in (1,2,3);

insert into leave_requests (requester_id, requester_role, from_date, to_date, reason, status)
select ts.id, 'student', current_date - 5, current_date - 4, 'Medical', 'approved'
from temp_students ts where ts.seq in (4,5);

insert into leave_requests (requester_id, requester_role, from_date, to_date, reason, status)
select tt.id, 'teacher', current_date + 7, current_date + 7, 'Personal', 'pending'
from temp_teachers tt where tt.seq = 1;

-- ============================================================
-- DONE.
-- Students/Teachers:  <firstname>@gmail.com        / <Firstname>1234
-- Parents:            <firstname>parent@gmail.com   / <Firstname>1234
-- e.g. aarav@gmail.com / Aarav1234, aaravparent@gmail.com / Aarav1234
-- Full name list: Aarav, Vivaan, Aditya, Vihaan, Arjun, Sai, Reyansh,
-- Ayaan, Krishna, Ishaan, Ananya, Diya, Saanvi, Aadhya, Kiara, Myra,
-- Anika, Navya, Riya, Prisha, Kabir, Rohan, Ira, Tara (students)
-- Anita, Ravi, Priya, Suresh, Deepak (teachers)
--
-- FEE / REPORT TEST COVERAGE (Tuition Fee 15000, Transport Fee 5000):
--   seq%3=0          Tuition fully paid        (e.g. Aditya seq 3, Sai seq 6)
--   seq%3=1          Tuition partial 7500      (e.g. Aarav seq 1)
--   seq%3=2          Tuition pending 9000      (e.g. Vivaan seq 2) -> no Pay
--   seq 7 (Reyansh) Tuition partial 5000 + pending 3000    -> no Pay
--   seq 8  (Ayaan)   rejected payment only     -> due, Pay visible
--   seq 9  (Krishna) Transport fully paid
--   all others       Transport unpaid          -> due, Pay visible
--   seq 23, 24       NO parent linked
--   class 11-B       NO class teacher (students seq 4, 8, 12, ...)
--   seq 6,12,18,24   student has no phone;  parent seq 5 has no phone
-- ============================================================
