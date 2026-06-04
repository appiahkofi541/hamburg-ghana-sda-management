-- Elders can access the department workspace and manage department records.
-- Department Heads retain the narrower own-department update policy from 008.
create policy "Elders can update departments"
  on public.departments for update to authenticated
  using (public.has_role('elder'))
  with check (public.has_role('elder'));

create policy "Elders can create departments"
  on public.departments for insert to authenticated
  with check (public.has_role('elder'));

create policy "Elders can delete departments"
  on public.departments for delete to authenticated
  using (public.has_role('elder'));
