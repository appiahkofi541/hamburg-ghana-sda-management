-- Event QR check-in support.
-- Allows members to check themselves in from /event-checkin/[eventId]
-- and marks whether attendance came from QR scan or manual leader action.

alter table public.event_attendance
  add column if not exists checkin_method text not null default 'manual',
  add column if not exists checked_in_at timestamptz;

update public.event_attendance
set checked_in_at = coalesce(checked_in_at, created_at)
where present = true
  and checked_in_at is null;

alter table public.event_attendance
  drop constraint if exists event_attendance_checkin_method_check;

alter table public.event_attendance
  add constraint event_attendance_checkin_method_check
  check (checkin_method in ('manual', 'qr_code'));

create index if not exists event_attendance_checkin_method_idx
on public.event_attendance (checkin_method);

create index if not exists event_attendance_checked_in_at_idx
on public.event_attendance (checked_in_at desc);

drop policy if exists "Members can QR check in to own event attendance" on public.event_attendance;

create policy "Members can QR check in to own event attendance"
on public.event_attendance for insert to authenticated
with check (
  public.is_own_event_member(member_id)
  and present = true
  and checkin_method = 'qr_code'
);

drop policy if exists "Members can update own QR event attendance" on public.event_attendance;

create policy "Members can update own QR event attendance"
on public.event_attendance for update to authenticated
using (public.is_own_event_member(member_id))
with check (
  public.is_own_event_member(member_id)
  and present = true
  and checkin_method = 'qr_code'
);

grant select, insert, update on public.event_attendance to authenticated;
