-- Super Admin/Admin event management for Hamburg Ghana SDA Church.
-- Members remain read-only/register-only through event_registrations policies.

alter table public.events
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create index if not exists events_department_id_idx
on public.events (department_id);

create index if not exists events_status_starts_at_idx
on public.events (status, starts_at);

alter table public.events enable row level security;

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
      and user_roles.role::text in ('super_admin', 'admin')
  );
$$;

drop policy if exists "Authenticated users can view events" on public.events;
drop policy if exists "Published events are visible to authenticated users" on public.events;
create policy "Published events are visible to authenticated users"
on public.events for select to authenticated
using (
  status = 'published'
  or public.can_manage_church_events()
);

drop policy if exists "Ministry leaders can manage events" on public.events;
drop policy if exists "Dynamic department managers can manage events" on public.events;
drop policy if exists "Super admins can manage church events" on public.events;
create policy "Super admins can manage church events"
on public.events for all to authenticated
using (public.can_manage_church_events())
with check (public.can_manage_church_events());

grant execute on function public.can_manage_church_events() to authenticated;
grant select, insert, update, delete on public.events to authenticated;
