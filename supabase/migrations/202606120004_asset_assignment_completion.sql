-- Complete asset assignment support for roles, locations, expected returns, and assigned status.

alter table public.asset_assignments
  add column if not exists assigned_role text,
  add column if not exists assigned_location text,
  add column if not exists expected_return_date date;

alter table public.asset_assignments
  drop constraint if exists asset_assignments_assigned_to_type_check;

alter table public.asset_assignments
  add constraint asset_assignments_assigned_to_type_check
  check (assigned_to_type in ('member', 'department', 'pastor', 'church_role', 'location'));

alter table public.assets
  drop constraint if exists assets_status_check;

alter table public.assets
  add constraint assets_status_check
  check (status in ('available', 'assigned', 'in_use', 'under_maintenance', 'retired', 'lost'));

create index if not exists asset_assignments_expected_return_idx
on public.asset_assignments (expected_return_date);

create index if not exists asset_assignments_role_idx
on public.asset_assignments (assigned_role);

create index if not exists asset_assignments_location_idx
on public.asset_assignments (assigned_location);
