-- Security-definer helpers read user roles without triggering recursive RLS.
create or replace function public.has_role(requested_role public.app_role)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = requested_role
  );
$$;

create or replace function public.has_any_role(requested_roles public.app_role[])
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = any(requested_roles)
  );
$$;

revoke execute on function public.has_role(public.app_role) from public;
revoke execute on function public.has_any_role(public.app_role[]) from public;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.departments enable row level security;
alter table public.members enable row level security;
alter table public.department_members enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_entries enable row level security;
alter table public.funds enable row level security;
alter table public.contribution_batches enable row level security;
alter table public.contributions enable row level security;
alter table public.events enable row level security;
alter table public.announcements enable row level security;

-- Users and roles
create policy "Authenticated users can view profiles"
  on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins can manage profiles"
  on public.profiles for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "Users can view their own roles"
  on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Admins can manage roles"
  on public.user_roles for all to authenticated using (public.has_role('admin')) with check (public.has_role('admin'));

-- Departments and members
create policy "Authenticated users can view departments"
  on public.departments for select to authenticated using (true);
create policy "Church leaders can manage departments"
  on public.departments for all to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));
create policy "Department heads can update their department"
  on public.departments for update to authenticated using (leader_id = auth.uid()) with check (leader_id = auth.uid());

create policy "Authenticated users can view members"
  on public.members for select to authenticated using (true);
create policy "Church leaders can manage members"
  on public.members for all to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'elder', 'secretary']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor', 'elder', 'secretary']::public.app_role[]));

create policy "Authenticated users can view department memberships"
  on public.department_members for select to authenticated using (true);
create policy "Church leaders can manage department memberships"
  on public.department_members for all to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'secretary', 'department_head']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor', 'secretary', 'department_head']::public.app_role[]));

-- Attendance
create policy "Authenticated users can view attendance sessions"
  on public.attendance_sessions for select to authenticated using (true);
create policy "Ministry leaders can manage attendance sessions"
  on public.attendance_sessions for all to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'elder', 'secretary', 'department_head']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor', 'elder', 'secretary', 'department_head']::public.app_role[]));

create policy "Authenticated users can view attendance entries"
  on public.attendance_entries for select to authenticated using (true);
create policy "Ministry leaders can manage attendance entries"
  on public.attendance_entries for all to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'elder', 'secretary', 'department_head']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor', 'elder', 'secretary', 'department_head']::public.app_role[]));

-- Tithe and offerings
create policy "Authenticated users can view active funds"
  on public.funds for select to authenticated using (is_active or public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
create policy "Treasury can manage funds"
  on public.funds for all to authenticated
  using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));

create policy "Treasury can view contribution batches"
  on public.contribution_batches for select to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'treasurer']::public.app_role[]));
create policy "Treasury can manage contribution batches"
  on public.contribution_batches for all to authenticated
  using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));

create policy "Treasury can view contributions"
  on public.contributions for select to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'treasurer']::public.app_role[]));
create policy "Treasury can manage contributions"
  on public.contributions for all to authenticated
  using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));

-- Events and announcements
create policy "Authenticated users can view events"
  on public.events for select to authenticated using (true);
create policy "Ministry leaders can manage events"
  on public.events for all to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'secretary', 'department_head']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor', 'secretary', 'department_head']::public.app_role[]));

create policy "Authenticated users can view announcements"
  on public.announcements for select to authenticated using (true);
create policy "Church leaders can manage announcements"
  on public.announcements for all to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'elder', 'secretary', 'department_head']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor', 'elder', 'secretary', 'department_head']::public.app_role[]));
