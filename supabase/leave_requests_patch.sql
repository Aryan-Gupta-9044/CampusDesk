-- Run this in SQL Editor. Fixes a gap in the original schema: teachers could
-- approve/reject student leave requests (UPDATE policy existed) but had no
-- way to actually see them first (no SELECT policy covering this case).

create policy "teacher views student leave requests"
on leave_requests for select
using (
  get_my_role() = 'teacher' and requester_role = 'student'
);
