-- Event registrations for the Member Portal.
-- Safe to run independently when public.event_registrations is missing from Supabase.

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  registration_status text not null default 'registered',
  attendance_confirmed boolean not null default false,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.event_registrations
  drop constraint if exists event_registrations_registration_status_check;

alter table public.event_registrations
  add constraint event_registrations_registration_status_check
  check (registration_status in ('registered', 'attended', 'cancelled'));

drop trigger if exists event_registrations_set_updated_at on public.event_registrations;
create trigger event_registrations_set_updated_at
before update on public.event_registrations
for each row execute function public.set_updated_at();

create index if not exists event_registrations_event_idx
on public.event_registrations (event_id);

create index if not exists event_registrations_member_idx
on public.event_registrations (member_id);

create index if not exists event_registrations_status_idx
on public.event_registrations (registration_status);

alter table public.event_registrations enable row level security;

drop policy if exists "Members can manage own event registrations" on public.event_registrations;
drop policy if exists "Leaders can view event registrations" on public.event_registrations;
drop policy if exists "Event leaders can manage event registrations" on public.event_registrations;
drop policy if exists "Members can insert own event registrations" on public.event_registrations;
drop policy if exists "Members can update own event registrations" on public.event_registrations;

create policy "Members can manage own event registrations"
on public.event_registrations for all to authenticated
using (
  exists (
    select 1
    from public.members
    where members.id = event_registrations.member_id
      and members.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.members
    where members.id = event_registrations.member_id
      and members.profile_id = auth.uid()
  )
);

create policy "Leaders can view event registrations"
on public.event_registrations for select to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[])
);

create policy "Event leaders can manage event registrations"
on public.event_registrations for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[])
);

grant select, insert, update, delete on public.event_registrations to authenticated;

insert into public.event_registrations (event_id, member_id, registration_status, attendance_confirmed, notes)
select event_seed.id, member_seed.id, 'registered', false, 'Demo event registration'
from (
  select id
  from public.events
  where starts_at >= now()
  order by starts_at
  limit 1
) event_seed
cross join lateral (
  select id
  from public.members
  order by created_at
  limit 3
) member_seed
on conflict (event_id, member_id) do nothing;
