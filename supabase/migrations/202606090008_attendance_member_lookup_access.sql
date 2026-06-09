-- Allow attendance managers to load active members for the Record Attendance form.
-- The members table uses id as the primary key and member_number as the church
-- membership number; it does not have a member_id column.

drop policy if exists "Attendance managers can view active member lookup" on public.members;

create policy "Attendance managers can view active member lookup"
on public.members for select to authenticated
using (
  status = 'active'
  and public.can_manage_attendance()
);

grant select on public.members to authenticated;
