begin;

create or replace function public.can_manage_governance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role::text in ('super_admin', 'admin', 'pastor', 'secretary', 'church_clerk')
  );
$$;

alter table public.governance_committee_members enable row level security;

drop policy if exists "Committee members are viewable by authenticated users" on public.governance_committee_members;
drop policy if exists "Governance managers can manage committee members" on public.governance_committee_members;
drop policy if exists "Governance managers can insert committee members" on public.governance_committee_members;
drop policy if exists "Governance managers can update committee members" on public.governance_committee_members;
drop policy if exists "Governance managers can delete committee members" on public.governance_committee_members;

create policy "Committee members are viewable by authenticated users"
on public.governance_committee_members
for select
to authenticated
using (true);

create policy "Governance managers can insert committee members"
on public.governance_committee_members
for insert
to authenticated
with check (public.can_manage_governance());

create policy "Governance managers can update committee members"
on public.governance_committee_members
for update
to authenticated
using (public.can_manage_governance())
with check (public.can_manage_governance());

create policy "Governance managers can delete committee members"
on public.governance_committee_members
for delete
to authenticated
using (public.can_manage_governance());

grant select, insert, update, delete on public.governance_committee_members to authenticated;
grant execute on function public.can_manage_governance() to authenticated;

commit;
