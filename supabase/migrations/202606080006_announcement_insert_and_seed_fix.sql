-- Ensure Communication announcements can be inserted by church communication managers
-- and visible to members when published for all members.

drop policy if exists "Members can view active communication announcements" on public.communication_announcements;
drop policy if exists "Announcement managers can manage communication announcements" on public.communication_announcements;

create policy "Members can view active communication announcements"
on public.communication_announcements for select to authenticated
using (
  status = 'published'
  and target_audience = 'all_members'
  and (scheduled_at is null or scheduled_at <= now())
  and (expires_at is null or expires_at >= now())
);

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
