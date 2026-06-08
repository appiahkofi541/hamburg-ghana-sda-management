-- Harden announcement creation and seed a demo published announcement when none exist.

drop policy if exists "Announcement managers can manage communication announcements" on public.communication_announcements;

create policy "Announcement managers can manage communication announcements"
on public.communication_announcements for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

insert into public.communication_announcements (
  title,
  body,
  target_audience,
  status,
  scheduled_at,
  expires_at
)
select
  'Welcome to Hamburg Ghana SDA Church',
  'Welcome to the Hamburg Ghana SDA Church Management System. Please check this announcements feed regularly for church updates, events, and ministry notices.',
  'all_members',
  'published',
  now(),
  now() + interval '90 days'
where not exists (
  select 1 from public.communication_announcements
);
