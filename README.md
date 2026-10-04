# CampusDesk — Student Management System

A full-stack student management system built with React and Supabase (Postgres,
Auth, Row Level Security, Storage). Four roles — Admin, Teacher, Student, and
Parent — each with their own dashboard and permissions enforced at the
database level, not just hidden in the UI.

## Features

- **Auth & roles** — Admin / Teacher / Student / Parent, with suspend/reactivate
  instead of hard delete (keeps academic history intact)
- **Students & Teachers** — add, edit, suspend; admin-created accounts get a
  real login the person can use immediately
- **Classes & Subjects** — define classes/sections, subjects, and which
  teacher teaches what
- **Attendance** — teachers mark it per class/subject/date; students, parents,
  and admin can view it
- **Exams, Marks & Results** — admin creates exams, teachers enter marks,
  admin computes and publishes ranked results
- **Fees** — fee structures per class, manually tracked payments (no payment
  gateway)
- **Notices & Events** — role- and class-targeted announcements, academic
  calendar
- **Leave requests** — students/teachers apply, teachers approve student
  leave, admin approves everyone's
- **Parent linking** — link a parent to their child by email, or create a new
  parent account on the spot
- **Audit log** — records suspensions, leave decisions, and result
  publication for accountability
- **Account recovery** — forgot-password flow, self-service profile/password
  settings
- **Analytics** — attendance/results/fee charts for the logged-in student
  (or a parent's linked child), per-class charts for a teacher's own
  subjects, and a full institution-wide overview for admin
- **Timetable** — admin builds a full weekly schedule per class; teachers
  can also add/edit periods for their own class+subject assignments
- **Fee payment verification** — student/parent can submit a payment claim
  ("I paid ₹X via UPI"), which sits as unverified until admin approves or
  rejects it — balances only update once confirmed
- **Chat with a teacher** — student/parent sends a short query (with a
  topic type) to a teacher in their class; teacher gets an inbox and
  replies inline
- **Auto-generated IDs** — roll numbers, employee IDs, and receipt numbers
  are generated automatically (not typed by admin), shown in a
  confirmation popup alongside the login credentials
- **File uploads** — profile photo (shown in the navbar), and a private
  "My documents" area for any role to upload/manage their own files
- **Notifications** — a bell icon aggregates recent notices and upcoming
  events with an unread badge (tracked per-device, no extra table)
- **Printable PDFs** — "Print report card" on Results and "Print receipt"
  per fee payment, using the browser's native print-to-PDF
- **Fee payment verification** — student/parent submits a payment claim,
  admin approves or rejects it in a dedicated queue before the balance
  updates
- **Teacher-managed timetable** — teachers can add/edit their own periods,
  not just admin
- **Chat with a teacher** — student/parent sends a short, typed query to
  a teacher in their class; teacher gets an inbox and replies inline
- **Academic report** — cumulative per-subject attendance and every test
  score in one place, for a student/parent, or (per class/subject) for
  a teacher
- **Admin one-click full report** — a single "View full report" button
  on any student or teacher pulls together their attendance, marks,
  fees, leave history, and documents in one page
- **Auto-generated IDs** — roll numbers, employee IDs, and receipt
  numbers are generated automatically and shown in a confirmation popup
  alongside login credentials

## Tech stack

- React 18 + React Router v6 (CRA)
- recharts for analytics charts
- Supabase: Postgres, Auth, Row Level Security, Storage
- No separate backend server — Supabase's client + RLS policies act as the API

## Setup

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com), then in the SQL
Editor, run (in order):

1. `supabase_schema.sql` — all tables, the auto-profile trigger, and RLS
   policies
2. `storage_setup.sql` — creates the `avatars` (public), `documents` and
   `receipts` (private) buckets and their policies; no manual bucket creation
3. `leave_requests_patch.sql` — fixes a gap where teachers could approve
   student leave but not see it
4. `profiles_rls_patch.sql` — scoped profile reads (teachers' profiles for
   everyone, a parent's own child, a student's own parent, student profiles
   for teachers) plus protection against self-changing role/status
5. `feature_additions_patch.sql` — fee payment verification states,
   teacher-managed timetable permissions, and the `teacher_queries` table
   for the chat feature
6. (optional) `seed_dummy_data.sql` — deletes any previous dummy data
   first, then populates a complete, manageable test set: 4 classes,
   24 students, 24 linked parents, 5 teachers, a full weekly timetable,
   15 days of per-subject attendance, 3 published exams per class with
   marks, fee payments (a realistic mix of paid/partial/pending
   verification), notices, events, and leave requests. Login is
   `<firstname>@gmail.com` for students/teachers and
   `<firstname>parent@gmail.com` for parents — password `<Firstname>1234`
   either way (e.g. `aarav@gmail.com` / `Aarav1234`). No dummy admin
   accounts are created.

Under **Authentication → Sign In / Providers → Email**, turn off "Confirm
email" for local development (turn it back on before any real deployment).

Under **Authentication → Email Templates → Reset Password**, replace the
link with:

```
{{ .SiteURL }}/#/reset-password?token_hash={{ .TokenHash }}&type=recovery
```

(Needed because this app uses `HashRouter` for GitHub Pages compatibility,
which otherwise conflicts with Supabase's default reset-link format.)

### 2. Environment variables

```
cp .env.example .env
```

Fill in `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` from
**Project Settings → API** in your Supabase dashboard.

### 3. Install & run

```
npm install
npm start
```

Sign up once at `/signup` with role **Student** or **Parent** (public signup
is intentionally limited to these two), then promote that first account to
Admin directly in Supabase:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

From there, use the Admin account to create Teacher accounts (and any
further Students) from inside the app.

## Project structure

```
src/
  lib/
    supabaseClient.js       # main Supabase client
    adminActionClient.js    # isolated client for admin-created signups
    queries/                # all Supabase reads/writes, grouped by domain
  context/AuthContext.js    # session, profile, role, suspend check
  components/               # Navbar, ProtectedRoute, shared UI bits
  pages/
    auth/                   # login, signup, password reset
    account/                # self-service settings
    dashboards/             # one dashboard per role
    admin/                  # admin-only CRUD pages
    shared/                 # pages that render differently per role
```

## Known limitations

- Fees are tracked manually — no payment gateway integration; students
  submit a claim, admin confirms it by hand
- Bulk CSV import still expects roll numbers/employee IDs in the file
  (not auto-generated like the single-add forms)
- Runs on `localhost` only — not yet deployed anywhere

## Supabase SQL order (V1)

1. `supabase/supabase_schema.sql`
2. `supabase/feature_additions_patch.sql`
3. `supabase/leave_requests_patch.sql` (if not already applied)
4. `supabase/profiles_rls_patch.sql` — scoped profile reads (replaces the old "everyone reads every profile" policy) + role/status protection
5. `supabase/fee_payment_guard_patch.sql` — one pending request per fee, no new overpayment, positive amounts
6. `supabase/storage_setup.sql` — creates the `avatars`, `documents` and `receipts` buckets and their access policies (replaces the old storage_policies.sql; no manual bucket creation needed)
7. (optional, test data only) `supabase/seed_dummy_data.sql` — run as ONE script/transaction
