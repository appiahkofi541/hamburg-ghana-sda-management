-- Pastor read-only access for event registrations and attendance reports.
-- Pastors can view event registration and attendance information without a linked member profile.
-- Only Super Admin/Admin and Secretary can manage event attendance records.

create or replace function public.can_view_event_reports()
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
      and user_roles.role::text in ('super_admin', 'admin', 'pastor', 'secretary')
  );
$$;

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

do $$
begin
  if to_regclass('public.event_registrations') is not null then
    alter table public.event_registrations enable row level security;

    drop policy if exists "Members can manage own event registrations" on public.event_registrations;
    drop policy if exists "Members can insert own event registrations" on public.event_registrations;
    drop policy if exists "Members can update own event registrations" on public.event_registrations;
    drop policy if exists "Leaders can view event registrations" on public.event_registrations;
    drop policy if exists "Event leaders can manage event registrations" on public.event_registrations;
    drop policy if exists "Event managers can view event registrations" on public.event_registrations;
    drop policy if exists "Event managers can manage event registrations" on public.event_registrations;
    drop policy if exists "Event report viewers can view event registrations" on public.event_registrations;
    drop policy if exists "Event managers can write event registrations" on public.event_registrations;

    create policy "Members can manage own event registrations"
    on public.event_registrations for all to authenticated
    using (public.is_own_event_member(member_id))
    with check (public.is_own_event_member(member_id));

    create policy "Event report viewers can view event registrations"
    on public.event_registrations for select to authenticated
    using (public.can_view_event_reports());

    create policy "Event managers can write event registrations"
    on public.event_registrations for all to authenticated
    using (public.can_manage_event_attendance())
    with check (public.can_manage_event_attendance());

    grant select, insert, update, delete on public.event_registrations to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.event_attendance') is not null then
    alter table public.event_attendance enable row level security;

    drop policy if exists "Members can view own event attendance" on public.event_attendance;
    drop policy if exists "Event managers can view event attendance" on public.event_attendance;
    drop policy if exists "Event managers can manage event attendance" on public.event_attendance;
    drop policy if exists "Event report viewers can view event attendance" on public.event_attendance;
    drop policy if exists "Event managers can write event attendance" on public.event_attendance;

    create policy "Members can view own event attendance"
    on public.event_attendance for select to authenticated
    using (public.is_own_event_member(member_id));

    create policy "Event report viewers can view event attendance"
    on public.event_attendance for select to authenticated
    using (public.can_view_event_reports());

    create policy "Event managers can write event attendance"
    on public.event_attendance for all to authenticated
    using (public.can_manage_event_attendance())
    with check (public.can_manage_event_attendance());

    grant select, insert, update, delete on public.event_attendance to authenticated;
  end if;
end $$;

grant execute on function public.can_view_event_reports() to authenticated;
grant execute on function public.can_manage_event_attendance() to authenticated;
grant execute on function public.is_own_event_member(uuid) to authenticated;
