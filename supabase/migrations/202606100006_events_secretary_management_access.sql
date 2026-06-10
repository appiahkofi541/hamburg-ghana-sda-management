-- Allow Secretary to manage church events alongside Super Admin/Admin.
-- Department Heads and Members remain view-only on public.events.

create or replace function public.can_manage_church_events()
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

drop policy if exists "Super admins can manage church events" on public.events;
drop policy if exists "Event managers can manage church events" on public.events;
create policy "Event managers can manage church events"
on public.events for all to authenticated
using (public.can_manage_church_events())
with check (public.can_manage_church_events());

drop policy if exists "Published events are visible to authenticated users" on public.events;
create policy "Published events are visible to authenticated users"
on public.events for select to authenticated
using (
  status = 'published'
  or public.can_manage_church_events()
);

grant execute on function public.can_manage_church_events() to authenticated;
grant select, insert, update, delete on public.events to authenticated;
