-- Fix member visibility for Communication Module announcements.
-- Members can select only active published announcements targeted to all members.

drop policy if exists "Members can view active communication announcements" on public.communication_announcements;

create policy "Members can view active communication announcements"
on public.communication_announcements for select to authenticated
using (
  status = 'published'
  and target_audience = 'all_members'
  and (scheduled_at is null or scheduled_at <= now())
  and (expires_at is null or expires_at >= now())
);
