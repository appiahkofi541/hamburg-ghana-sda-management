-- Explicit Communication Announcement manager policies.
-- Allows authenticated users with super_admin, pastor, elder, or secretary roles
-- to insert, update, delete, and view communication_announcements.

drop policy if exists "Announcement managers can manage communication announcements" on public.communication_announcements;
drop policy if exists "Announcement managers can view communication announcements" on public.communication_announcements;
drop policy if exists "Announcement managers can insert communication announcements" on public.communication_announcements;
drop policy if exists "Announcement managers can update communication announcements" on public.communication_announcements;
drop policy if exists "Announcement managers can delete communication announcements" on public.communication_announcements;

create policy "Announcement managers can view communication announcements"
on public.communication_announcements for select to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

create policy "Announcement managers can insert communication announcements"
on public.communication_announcements for insert to authenticated
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
  and target_audience in ('all_members', 'department', 'leaders')
  and status in ('draft', 'scheduled', 'published', 'expired')
  and (expires_at is null or scheduled_at is null or expires_at >= scheduled_at)
);

create policy "Announcement managers can update communication announcements"
on public.communication_announcements for update to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
  and target_audience in ('all_members', 'department', 'leaders')
  and status in ('draft', 'scheduled', 'published', 'expired')
  and (expires_at is null or scheduled_at is null or expires_at >= scheduled_at)
);

create policy "Announcement managers can delete communication announcements"
on public.communication_announcements for delete to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);
