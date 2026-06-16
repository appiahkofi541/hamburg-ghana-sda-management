-- Sync member event attendance confirmations into public.event_attendance.
-- Safe to run repeatedly.

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
      and (
        members.profile_id = auth.uid()
        or (
          members.email is not null
          and nullif(auth.jwt() ->> 'email', '') is not null
          and lower(members.email) = lower(auth.jwt() ->> 'email')
        )
      )
  );
$$;

do $$
begin
  if to_regclass('public.event_attendance') is not null then
    alter table public.event_attendance
      add column if not exists checkin_method text not null default 'manual',
      add column if not exists checked_in_at timestamptz,
      add column if not exists notes text;

    alter table public.event_attendance
      drop constraint if exists event_attendance_checkin_method_check;

    alter table public.event_attendance
      add constraint event_attendance_checkin_method_check
      check (checkin_method in ('manual', 'qr_code', 'self_confirmed'));

    alter table public.event_attendance enable row level security;

    drop policy if exists "Members can self-confirm own event attendance" on public.event_attendance;
    drop policy if exists "Members can update own self-confirmed event attendance" on public.event_attendance;

    create policy "Members can self-confirm own event attendance"
    on public.event_attendance for insert to authenticated
    with check (
      public.is_own_event_member(member_id)
      and present = true
      and checkin_method in ('qr_code', 'self_confirmed')
    );

    create policy "Members can update own self-confirmed event attendance"
    on public.event_attendance for update to authenticated
    using (public.is_own_event_member(member_id))
    with check (
      public.is_own_event_member(member_id)
      and present = true
      and checkin_method in ('qr_code', 'self_confirmed')
    );

    grant select, insert, update on public.event_attendance to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.event_registrations') is not null
     and to_regclass('public.event_attendance') is not null then
    insert into public.event_attendance (
      event_id,
      member_id,
      present,
      checked_in_at,
      checkin_method,
      notes
    )
    select
      event_registrations.event_id,
      event_registrations.member_id,
      true,
      coalesce(event_registrations.confirmed_at, event_registrations.updated_at, event_registrations.registration_date, now()),
      'self_confirmed',
      'Backfilled from confirmed event registration.'
    from public.event_registrations
    where event_registrations.attendance_confirmed = true
      and event_registrations.event_id is not null
      and event_registrations.member_id is not null
    on conflict (event_id, member_id) do update
    set present = true,
        checked_in_at = coalesce(public.event_attendance.checked_in_at, excluded.checked_in_at),
        checkin_method = case
          when public.event_attendance.checkin_method = 'manual' then public.event_attendance.checkin_method
          else excluded.checkin_method
        end,
        notes = coalesce(public.event_attendance.notes, excluded.notes),
        updated_at = now();
  end if;
end $$;

grant execute on function public.is_own_event_member(uuid) to authenticated;
