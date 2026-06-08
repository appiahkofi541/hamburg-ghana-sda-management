-- Dynamic Departments improvements.
-- Allows future departments to be created without hardcoded names, assigns heads,
-- prevents duplicate department names, and supports active/inactive status.

create unique index if not exists departments_name_lower_unique_idx
on public.departments (lower(name));

drop policy if exists "Clerks and pastors can manage departments" on public.departments;
drop policy if exists "Department heads can manage assigned departments" on public.departments;
drop policy if exists "Department managers can view departments" on public.departments;
drop policy if exists "Department managers can insert departments" on public.departments;
drop policy if exists "Department managers can update departments" on public.departments;
drop policy if exists "Department managers can delete departments" on public.departments;

create policy "Department managers can view departments"
on public.departments for select to authenticated
using (true);

create policy "Department managers can insert departments"
on public.departments for insert to authenticated
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
);

create policy "Department managers can update departments"
on public.departments for update to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
);

create policy "Department managers can delete departments"
on public.departments for delete to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
);

drop policy if exists "Clerks and pastors can manage department memberships" on public.department_members;
drop policy if exists "Department heads can view assigned department memberships" on public.department_members;
drop policy if exists "Department managers can view department memberships" on public.department_members;
drop policy if exists "Department managers can insert department memberships" on public.department_members;
drop policy if exists "Department managers can update department memberships" on public.department_members;
drop policy if exists "Department managers can delete department memberships" on public.department_members;

create policy "Department managers can view department memberships"
on public.department_members for select to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
  or (public.has_role('department_head') and public.is_department_leader_for_department(department_id))
);

create policy "Department managers can insert department memberships"
on public.department_members for insert to authenticated
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
);

create policy "Department managers can update department memberships"
on public.department_members for update to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
);

create policy "Department managers can delete department memberships"
on public.department_members for delete to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
);

insert into public.departments (name, description, is_active)
values
  ('Health & Temperance', 'Health, temperance, wellness, and lifestyle ministry coordination.', true),
  ('Singing Band', 'Singing band ministry, rehearsals, and music support.', true)
on conflict (name) do nothing;
