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

alter table public.governance_polls enable row level security;
alter table public.governance_candidates enable row level security;

drop policy if exists "Governance polls are viewable by authenticated users" on public.governance_polls;
drop policy if exists "Governance managers can manage polls" on public.governance_polls;
drop policy if exists "Governance managers can insert polls" on public.governance_polls;
drop policy if exists "Governance managers can update polls" on public.governance_polls;
drop policy if exists "Governance managers can delete polls" on public.governance_polls;

create policy "Governance polls are viewable by authenticated users"
on public.governance_polls
for select
to authenticated
using (true);

create policy "Governance managers can insert polls"
on public.governance_polls
for insert
to authenticated
with check (public.can_manage_governance());

create policy "Governance managers can update polls"
on public.governance_polls
for update
to authenticated
using (public.can_manage_governance())
with check (public.can_manage_governance());

create policy "Governance managers can delete polls"
on public.governance_polls
for delete
to authenticated
using (public.can_manage_governance());

drop policy if exists "Governance candidates are viewable by authenticated users" on public.governance_candidates;
drop policy if exists "Governance managers can manage candidates" on public.governance_candidates;
drop policy if exists "Governance managers can insert candidates" on public.governance_candidates;
drop policy if exists "Governance managers can update candidates" on public.governance_candidates;
drop policy if exists "Governance managers can delete candidates" on public.governance_candidates;

create policy "Governance candidates are viewable by authenticated users"
on public.governance_candidates
for select
to authenticated
using (true);

create policy "Governance managers can insert candidates"
on public.governance_candidates
for insert
to authenticated
with check (public.can_manage_governance());

create policy "Governance managers can update candidates"
on public.governance_candidates
for update
to authenticated
using (public.can_manage_governance())
with check (public.can_manage_governance());

create policy "Governance managers can delete candidates"
on public.governance_candidates
for delete
to authenticated
using (public.can_manage_governance());

grant select, insert, update, delete on public.governance_polls, public.governance_candidates to authenticated;
grant execute on function public.can_manage_governance() to authenticated;

commit;
