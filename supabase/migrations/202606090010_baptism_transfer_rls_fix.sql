-- Fix Baptism & Membership Transfer RLS policies.
-- This migration makes the module manageable by approved church leadership
-- roles and readable by the same authenticated roles.

create or replace function public.can_manage_baptism_transfers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role::text in ('super_admin', 'admin', 'pastor', 'elder', 'secretary', 'church_clerk')
  );
$$;

create or replace function public.can_view_baptism_transfers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role::text in ('super_admin', 'admin', 'pastor', 'elder', 'secretary', 'church_clerk')
  );
$$;

alter table public.baptism_candidates enable row level security;
alter table public.baptism_classes enable row level security;
alter table public.baptism_records enable row level security;
alter table public.membership_transfer_in enable row level security;
alter table public.membership_transfer_out enable row level security;
alter table public.profession_of_faith_records enable row level security;

drop policy if exists "Baptism transfer viewers can view candidates" on public.baptism_candidates;
drop policy if exists "Baptism transfer managers can manage candidates" on public.baptism_candidates;
drop policy if exists "Baptism transfer leaders can select candidates" on public.baptism_candidates;
drop policy if exists "Baptism transfer leaders can insert candidates" on public.baptism_candidates;
drop policy if exists "Baptism transfer leaders can update candidates" on public.baptism_candidates;
drop policy if exists "Baptism transfer leaders can delete candidates" on public.baptism_candidates;

create policy "Baptism transfer leaders can select candidates"
on public.baptism_candidates for select to authenticated
using (public.can_view_baptism_transfers());

create policy "Baptism transfer leaders can insert candidates"
on public.baptism_candidates for insert to authenticated
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can update candidates"
on public.baptism_candidates for update to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can delete candidates"
on public.baptism_candidates for delete to authenticated
using (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view classes" on public.baptism_classes;
drop policy if exists "Baptism transfer managers can manage classes" on public.baptism_classes;
drop policy if exists "Baptism transfer leaders can select classes" on public.baptism_classes;
drop policy if exists "Baptism transfer leaders can insert classes" on public.baptism_classes;
drop policy if exists "Baptism transfer leaders can update classes" on public.baptism_classes;
drop policy if exists "Baptism transfer leaders can delete classes" on public.baptism_classes;

create policy "Baptism transfer leaders can select classes"
on public.baptism_classes for select to authenticated
using (public.can_view_baptism_transfers());

create policy "Baptism transfer leaders can insert classes"
on public.baptism_classes for insert to authenticated
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can update classes"
on public.baptism_classes for update to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can delete classes"
on public.baptism_classes for delete to authenticated
using (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view baptism records" on public.baptism_records;
drop policy if exists "Baptism transfer managers can manage baptism records" on public.baptism_records;
drop policy if exists "Baptism transfer leaders can select baptism records" on public.baptism_records;
drop policy if exists "Baptism transfer leaders can insert baptism records" on public.baptism_records;
drop policy if exists "Baptism transfer leaders can update baptism records" on public.baptism_records;
drop policy if exists "Baptism transfer leaders can delete baptism records" on public.baptism_records;

create policy "Baptism transfer leaders can select baptism records"
on public.baptism_records for select to authenticated
using (public.can_view_baptism_transfers());

create policy "Baptism transfer leaders can insert baptism records"
on public.baptism_records for insert to authenticated
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can update baptism records"
on public.baptism_records for update to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can delete baptism records"
on public.baptism_records for delete to authenticated
using (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view transfer in" on public.membership_transfer_in;
drop policy if exists "Baptism transfer managers can manage transfer in" on public.membership_transfer_in;
drop policy if exists "Baptism transfer leaders can select transfer in" on public.membership_transfer_in;
drop policy if exists "Baptism transfer leaders can insert transfer in" on public.membership_transfer_in;
drop policy if exists "Baptism transfer leaders can update transfer in" on public.membership_transfer_in;
drop policy if exists "Baptism transfer leaders can delete transfer in" on public.membership_transfer_in;

create policy "Baptism transfer leaders can select transfer in"
on public.membership_transfer_in for select to authenticated
using (public.can_view_baptism_transfers());

create policy "Baptism transfer leaders can insert transfer in"
on public.membership_transfer_in for insert to authenticated
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can update transfer in"
on public.membership_transfer_in for update to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can delete transfer in"
on public.membership_transfer_in for delete to authenticated
using (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view transfer out" on public.membership_transfer_out;
drop policy if exists "Baptism transfer managers can manage transfer out" on public.membership_transfer_out;
drop policy if exists "Baptism transfer leaders can select transfer out" on public.membership_transfer_out;
drop policy if exists "Baptism transfer leaders can insert transfer out" on public.membership_transfer_out;
drop policy if exists "Baptism transfer leaders can update transfer out" on public.membership_transfer_out;
drop policy if exists "Baptism transfer leaders can delete transfer out" on public.membership_transfer_out;

create policy "Baptism transfer leaders can select transfer out"
on public.membership_transfer_out for select to authenticated
using (public.can_view_baptism_transfers());

create policy "Baptism transfer leaders can insert transfer out"
on public.membership_transfer_out for insert to authenticated
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can update transfer out"
on public.membership_transfer_out for update to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can delete transfer out"
on public.membership_transfer_out for delete to authenticated
using (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view professions of faith" on public.profession_of_faith_records;
drop policy if exists "Baptism transfer managers can manage professions of faith" on public.profession_of_faith_records;
drop policy if exists "Baptism transfer leaders can select professions of faith" on public.profession_of_faith_records;
drop policy if exists "Baptism transfer leaders can insert professions of faith" on public.profession_of_faith_records;
drop policy if exists "Baptism transfer leaders can update professions of faith" on public.profession_of_faith_records;
drop policy if exists "Baptism transfer leaders can delete professions of faith" on public.profession_of_faith_records;

create policy "Baptism transfer leaders can select professions of faith"
on public.profession_of_faith_records for select to authenticated
using (public.can_view_baptism_transfers());

create policy "Baptism transfer leaders can insert professions of faith"
on public.profession_of_faith_records for insert to authenticated
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can update professions of faith"
on public.profession_of_faith_records for update to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can delete professions of faith"
on public.profession_of_faith_records for delete to authenticated
using (public.can_manage_baptism_transfers());

grant select, insert, update, delete on
  public.baptism_candidates,
  public.baptism_classes,
  public.baptism_records,
  public.membership_transfer_in,
  public.membership_transfer_out,
  public.profession_of_faith_records
to authenticated;

grant execute on function public.can_manage_baptism_transfers() to authenticated;
grant execute on function public.can_view_baptism_transfers() to authenticated;
