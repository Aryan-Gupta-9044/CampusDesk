-- Run this in the SQL Editor. Safe to re-run.
--
-- Why this patch exists: several pages embed profiles.full_name/email/phone
-- for people who are not the row owner (a parent viewing their child, a
-- student seeing their class teacher, a teacher listing a roster). With only
-- "read own profile" those embeds came back empty, and anything using
-- .single() failed with "Cannot coerce the result to a single JSON object".
--
-- The previous version of this patch fixed that by letting EVERY signed-in
-- user read EVERY profile. Now that profiles carries phone numbers, that
-- would let Student A read Student B's email/phone. This version replaces
-- it with scoped read policies, so each role sees only the people it needs.

drop policy if exists "authenticated users read all profiles" on profiles;

-- Everyone signed in may read TEACHER profiles (class teacher / subject
-- teacher names and contact details are part of the school directory).
drop policy if exists "read teacher profiles" on profiles;
create policy "read teacher profiles" on profiles for select
using (
  auth.uid() is not null
  and exists (select 1 from teachers t where t.id = profiles.id)
);

-- A parent reads the profile of their own linked child only.
drop policy if exists "parent reads linked child profile" on profiles;
create policy "parent reads linked child profile" on profiles for select
using (
  exists (select 1 from students s where s.id = profiles.id and s.parent_id = auth.uid())
);

-- A student reads the profile of their own linked parent only.
drop policy if exists "student reads own parent profile" on profiles;
create policy "student reads own parent profile" on profiles for select
using (
  exists (select 1 from students s where s.parent_id = profiles.id and s.id = auth.uid())
);

-- Teachers keep the access they had before to student profiles
-- (rosters, attendance, marks, leave approvals). Teacher permissions are
-- unchanged; students and parents do NOT get this.
drop policy if exists "teacher reads student profiles" on profiles;
create policy "teacher reads student profiles" on profiles for select
using (
  get_my_role() = 'teacher' and profiles.role = 'student'
);

-- (Existing, unchanged) "user reads own profile" and
-- "admin full access profiles" remain from the base schema.

-- ------------------------------------------------------------
-- Hardening: a non-admin may edit their own name/phone/avatar but must not
-- be able to change their own role or status through the profile-update
-- policy. SQL-editor / service-role changes (auth.uid() is null) and the
-- signup trigger are unaffected.
-- ------------------------------------------------------------
create or replace function public.profiles_protect_role_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status then
      raise exception 'Only an administrator can change a role or account status.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role_status_trg on profiles;
create trigger profiles_protect_role_status_trg
  before update on profiles
  for each row execute function public.profiles_protect_role_status();
