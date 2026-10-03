-- ============================================================
-- CampusDesk V1 — Fee payment guard patch
-- Run once in the Supabase SQL Editor (after the other patches).
-- Safe to re-run. Does NOT delete or edit any existing payment rows.
-- ============================================================

-- 1. At most ONE pending_verification request per student per fee item.
--    Backs up the app-level duplicate check so two browser tabs (or a
--    student and a parent at the same moment) cannot both get through.
--    If this fails with "could not create unique index", you already have
--    duplicate pending rows: resolve them in Admin > Fees first, then re-run.
create unique index if not exists fee_payments_one_pending_per_fee
  on fee_payments (student_id, fee_structure_id)
  where status = 'pending_verification';

-- 2. Reject non-positive amounts on new/updated rows (NOT VALID = existing
--    rows are left untouched and not re-checked).
alter table fee_payments drop constraint if exists fee_payments_amount_positive;
alter table fee_payments add constraint fee_payments_amount_positive
  check (amount_paid > 0) not valid;

-- 3. Block NEW over-payment at the database level. Fires only when a row
--    becomes confirmed ('paid'/'partial'): on insert, or when an update
--    changes the status or amount. Existing historical over-payments are
--    preserved; they are not touched unless someone edits those rows.
create or replace function public.fee_payments_no_overpay()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  fee_amount numeric;
  other_confirmed numeric;
begin
  if new.status not in ('paid','partial') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status in ('paid','partial')
     and old.amount_paid is not distinct from new.amount_paid
     and old.fee_structure_id is not distinct from new.fee_structure_id then
    return new; -- untouched confirmed row (e.g. receipt edit)
  end if;

  select amount into fee_amount from fee_structure where id = new.fee_structure_id;
  if fee_amount is null then
    return new;
  end if;

  select coalesce(sum(amount_paid), 0) into other_confirmed
  from fee_payments
  where student_id = new.student_id
    and fee_structure_id = new.fee_structure_id
    and status in ('paid','partial')
    and id <> new.id;

  if other_confirmed + coalesce(new.amount_paid, 0) > fee_amount then
    raise exception 'Payment would exceed the fee amount (fee %, already confirmed %, this payment %).',
      fee_amount, other_confirmed, new.amount_paid;
  end if;
  return new;
end;
$$;

drop trigger if exists fee_payments_no_overpay_trg on fee_payments;
create trigger fee_payments_no_overpay_trg
  before insert or update on fee_payments
  for each row execute function public.fee_payments_no_overpay();

-- 4. Read-only audit of EXISTING over-payments (nothing is modified).
--    Review the result; clean up manually only if you decide to.
-- select s.roll_no, fs.fee_type, fs.amount as fee_amount,
--        sum(p.amount_paid) as confirmed_total
-- from fee_payments p
-- join fee_structure fs on fs.id = p.fee_structure_id
-- join students s on s.id = p.student_id
-- where p.status in ('paid','partial')
-- group by s.roll_no, fs.fee_type, fs.amount
-- having sum(p.amount_paid) > fs.amount;
