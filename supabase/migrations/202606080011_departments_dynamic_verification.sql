-- Departments dynamic verification and cross-module support.
-- Keeps department metadata in the database, prevents duplicate names, and lets events
-- reference the same departments used by member forms, attendance, communications, and reports.

alter table public.departments
  add column if not exists description text,
  add column if not exists leader_id uuid references public.profiles(id) on delete set null,
  add column if not exists meeting_schedule text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.departments
set name = trim(name)
where name <> trim(name);

with duplicates as (
  select
    id,
    row_number() over (partition by lower(name) order by created_at, id) as duplicate_number
  from public.departments
)
update public.departments
set name = public.departments.name || ' (' || left(public.departments.id::text, 8) || ')'
from duplicates
where public.departments.id = duplicates.id
  and duplicates.duplicate_number > 1;

create unique index if not exists departments_name_lower_unique_idx
on public.departments (lower(name));

alter table public.events
  add column if not exists department_id uuid references public.departments(id) on delete set null;

create index if not exists events_department_id_idx
on public.events (department_id);

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

drop policy if exists "Department managers can view department memberships" on public.department_members;
drop policy if exists "Department managers can insert department memberships" on public.department_members;
drop policy if exists "Department managers can update department memberships" on public.department_members;
drop policy if exists "Department managers can delete department memberships" on public.department_members;

create policy "Department managers can view department memberships"
on public.department_members for select to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'church_clerk']::public.app_role[])
  or (public.has_role('department_head') and public.is_department_leader_for_department(department_id))
  or exists (
    select 1
    from public.members
    where members.id = department_members.member_id
      and members.profile_id = auth.uid()
  )
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

drop policy if exists "Ministry leaders can manage events" on public.events;
drop policy if exists "Dynamic department managers can manage events" on public.events;

create policy "Dynamic department managers can manage events"
on public.events for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[])
);
