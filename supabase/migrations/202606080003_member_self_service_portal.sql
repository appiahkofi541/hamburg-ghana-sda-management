-- Priority 8: Member Self-Service Portal.
-- Adds member announcement read tracking, event registration/attendance confirmation,
-- member-safe profile updates, and refreshed RLS for member-owned records.

create table if not exists public.member_announcement_reads (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  announcement_id uuid not null references public.communication_announcements(id) on delete cascade,
  read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (member_id, announcement_id)
);

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  registration_status text not null default 'registered'
    check (registration_status in ('registered', 'cancelled', 'attended', 'absent')),
  attendance_confirmed boolean not null default false,
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, member_id)
);

drop trigger if exists event_registrations_set_updated_at on public.event_registrations;
create trigger event_registrations_set_updated_at
before update on public.event_registrations
for each row execute function public.set_updated_at();

create index if not exists member_announcement_reads_member_idx on public.member_announcement_reads (member_id);
create index if not exists member_announcement_reads_announcement_idx on public.member_announcement_reads (announcement_id);
create index if not exists event_registrations_event_idx on public.event_registrations (event_id);
create index if not exists event_registrations_member_idx on public.event_registrations (member_id);
create index if not exists event_registrations_status_idx on public.event_registrations (registration_status);

alter table public.member_announcement_reads enable row level security;
alter table public.event_registrations enable row level security;

drop policy if exists "Members can manage own announcement reads" on public.member_announcement_reads;
drop policy if exists "Leaders can view announcement reads" on public.member_announcement_reads;
drop policy if exists "Members can manage own event registrations" on public.event_registrations;
drop policy if exists "Leaders can view event registrations" on public.event_registrations;
drop policy if exists "Event leaders can manage event registrations" on public.event_registrations;

create policy "Members can manage own announcement reads"
on public.member_announcement_reads for all to authenticated
using (member_id in (select id from public.members where profile_id = auth.uid()))
with check (member_id in (select id from public.members where profile_id = auth.uid()));

create policy "Leaders can view announcement reads"
on public.member_announcement_reads for select to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary', 'church_clerk']::public.app_role[])
);

create policy "Members can manage own event registrations"
on public.event_registrations for all to authenticated
using (member_id in (select id from public.members where profile_id = auth.uid()))
with check (member_id in (select id from public.members where profile_id = auth.uid()));

create policy "Leaders can view event registrations"
on public.event_registrations for select to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary', 'church_clerk']::public.app_role[])
);

create policy "Event leaders can manage event registrations"
on public.event_registrations for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary', 'church_clerk']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary', 'church_clerk']::public.app_role[])
);

drop policy if exists "Members can update own self service profile" on public.members;
create policy "Members can update own self service profile"
on public.members for update to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

-- Refresh prayer portal policies for the real RBAC roles while keeping member ownership.
drop policy if exists "Church can view public and own prayer requests" on public.prayer_requests;
drop policy if exists "Pastoral team can manage prayer requests" on public.prayer_requests;
drop policy if exists "Church can view published and own testimonies" on public.prayer_testimonies;
drop policy if exists "Pastoral team can manage testimonies" on public.prayer_testimonies;

create policy "Church can view public and own prayer requests"
on public.prayer_requests for select to authenticated
using (
  is_public
  or submitted_by = auth.uid()
  or public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

create policy "Pastoral team can manage prayer requests"
on public.prayer_requests for update to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

create policy "Church can view published and own testimonies"
on public.prayer_testimonies for select to authenticated
using (
  (is_public and status = 'published')
  or submitted_by = auth.uid()
  or public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

create policy "Pastoral team can manage testimonies"
on public.prayer_testimonies for update to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

grant select, insert, update, delete on public.member_announcement_reads to authenticated;
grant select, insert, update, delete on public.event_registrations to authenticated;

insert into public.event_registrations (event_id, member_id, registration_status, attendance_confirmed, notes)
select e.id, m.id, 'registered', false, 'Demo self-service event registration'
from public.events e
cross join lateral (select id from public.members order by created_at limit 3) m
where e.starts_at >= now()
on conflict (event_id, member_id) do nothing;
