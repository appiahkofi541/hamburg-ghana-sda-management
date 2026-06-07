-- Allow finance workflows to load active members for the Add Contribution dropdown.
-- Treasurer needs member names and member numbers to record payments against members.

drop policy if exists "Finance users can view active members for payments" on public.members;
create policy "Finance users can view active members for payments"
on public.members for select to authenticated
using (
  status = 'active'
  and public.has_any_role(array['treasurer']::public.app_role[])
);
