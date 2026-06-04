-- Elders can manage members in the app, including department assignments.
-- Keep the join-table policy aligned with that member workspace permission.
create policy "Elders can manage department memberships"
  on public.department_members for all to authenticated
  using (public.has_role('elder'))
  with check (public.has_role('elder'));
