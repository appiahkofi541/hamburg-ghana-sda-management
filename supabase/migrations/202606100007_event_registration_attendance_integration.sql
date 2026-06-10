-- Event registration and attendance integration.
-- Adds event_attendance and aligns event_registrations with registration_date/status.

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  registration_date timestamptz not null default now(),
  status text not null default 'registered',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);

alter table public.event_registrations
  add column if not exists registration_date timestamptz not null default now(),
  add column if not exists status text not null default 'registered',
  add column if not exists registration_status text not null default 'registered',
  add column if not exists attendance_confirmed boolean not null default false,
  add column if not exists confirmed_at timestamptz,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.event_registrations
set
  registration_date = coalesce(registration_date, created_at, now()),
  status = coalesce(nullif(status, ''), registration_status, 'registered'),
  registration_status = coalesce(nullif(registration_status, ''), status, 'registered');

alter table public.event_registrations
  drop constraint if exists event_registrations_status_check;

alter table public.event_registrations
  add constraint event_registrations_status_check
  check (status in ('registered', 'attended', 'cancelled'));

alter table public.event_registrations
  drop constraint if exists event_registrations_registration_status_check;

alter table public.event_registrations
  add constraint event_registrations_registration_status_check
  check (registration_status in ('registered', 'attended', 'cancelled'));

create table if not exists public.event_attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  present boolean not null default false,
  checked_by uuid references public.profiles(id) on delete set null,
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

drop trigger if exists event_registrations_set_updated_at on public.event_registrations;
create trigger event_registrations_set_updated_at
before update on public.event_registrations
for each row execute function public.set_updated_at();

drop trigger if exists event_attendance_set_updated_at on public.event_attendance;
create trigger event_attendance_set_updated_at
before update on public.event_attendance
for each row execute function public.set_updated_at();

create index if not exists event_registrations_event_idx
on public.event_registrations (event_id);

create index if not exists event_registrations_member_idx
on public.event_registrations (member_id);

create index if not exists event_registrations_status_idx
on public.event_registrations (status);

create unique index if not exists event_registrations_event_member_uidx
on public.event_registrations (event_id, member_id);

create index if not exists event_attendance_event_idx
on public.event_attendance (event_id);

create index if not exists event_attendance_member_idx
on public.event_attendance (member_id);

create index if not exists event_attendance_present_idx
on public.event_attendance (present);

create unique index if not exists event_attendance_event_member_uidx
on public.event_attendance (event_id, member_id);

create or replace function public.can_manage_event_attendance()
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
      and user_roles.role::text in ('super_admin', 'admin', 'secretary')
  );
$$;

create or replace function public.is_own_event_member(target_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members
    where members.id = target_member_id
      and members.profile_id = auth.uid()
  );
$$;

alter table public.event_registrations enable row level security;
alter table public.event_attendance enable row level security;

drop policy if exists "Members can manage own event registrations" on public.event_registrations;
drop policy if exists "Members can insert own event registrations" on public.event_registrations;
drop policy if exists "Members can update own event registrations" on public.event_registrations;
drop policy if exists "Leaders can view event registrations" on public.event_registrations;
drop policy if exists "Event leaders can manage event registrations" on public.event_registrations;
drop policy if exists "Event managers can view event registrations" on public.event_registrations;
drop policy if exists "Event managers can manage event registrations" on public.event_registrations;

create policy "Members can manage own event registrations"
on public.event_registrations for all to authenticated
using (public.is_own_event_member(member_id))
with check (public.is_own_event_member(member_id));

create policy "Event managers can view event registrations"
on public.event_registrations for select to authenticated
using (public.can_manage_event_attendance());

create policy "Event managers can manage event registrations"
on public.event_registrations for all to authenticated
using (public.can_manage_event_attendance())
with check (public.can_manage_event_attendance());

drop policy if exists "Members can view own event attendance" on public.event_attendance;
drop policy if exists "Event managers can view event attendance" on public.event_attendance;
drop policy if exists "Event managers can manage event attendance" on public.event_attendance;

create policy "Members can view own event attendance"
on public.event_attendance for select to authenticated
using (public.is_own_event_member(member_id));

create policy "Event managers can view event attendance"
on public.event_attendance for select to authenticated
using (public.can_manage_event_attendance());

create policy "Event managers can manage event attendance"
on public.event_attendance for all to authenticated
using (public.can_manage_event_attendance())
with check (public.can_manage_event_attendance());

grant execute on function public.can_manage_event_attendance() to authenticated;
grant execute on function public.is_own_event_member(uuid) to authenticated;
grant select, insert, update, delete on public.event_registrations to authenticated;
grant select, insert, update, delete on public.event_attendance to authenticated;
