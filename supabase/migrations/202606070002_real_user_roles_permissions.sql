-- Real RBAC model for Hamburg Ghana SDA Church Management System.
--
-- IMPORTANT:
-- Run 202606070001_add_real_rbac_enum_values.sql first, then run this file.
-- PostgreSQL requires a commit after adding enum values before those values
-- can be used in policies, functions, or data updates.
--
-- Roles retained by the application:
-- super_admin, pastor, elder, church_clerk, secretary, treasurer,
-- department_head, member.

-- Migrate only the old Admin role. Elder and Secretary remain separate roles.
update public.user_roles
set role = 'super_admin'
where role = 'admin';

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
      and (role = requested_role or role::text = 'super_admin')
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
      and (role = any(requested_roles) or role::text = 'super_admin')
  );
$$;

create or replace function public.is_department_leader_for_member(target_member_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.departments
    join public.department_members on department_members.department_id = departments.id
    where departments.leader_id = auth.uid()
      and department_members.member_id = target_member_id
  );
$$;

create or replace function public.is_department_leader_for_department(target_department_id uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.departments
    where departments.id = target_department_id
      and departments.leader_id = auth.uid()
  );
$$;

revoke execute on function public.has_role(public.app_role) from public;
revoke execute on function public.has_any_role(public.app_role[]) from public;
revoke execute on function public.is_department_leader_for_member(uuid) from public;
revoke execute on function public.is_department_leader_for_department(uuid) from public;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.is_department_leader_for_member(uuid) to authenticated;
grant execute on function public.is_department_leader_for_department(uuid) to authenticated;

create or replace function public.can_manage_member_photo(object_name text)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select
    public.has_any_role(array['church_clerk', 'secretary']::public.app_role[])
    or exists (
      select 1
      from public.members
      where members.id = public.member_photo_member_id(object_name)
        and members.profile_id = auth.uid()
    );
$$;

revoke execute on function public.can_manage_member_photo(text) from public;
grant execute on function public.can_manage_member_photo(text) to authenticated;

create or replace function public.admin_set_user_role(target_user_id uuid, new_role public.app_role)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.has_role('super_admin') then
    raise exception 'Super Admin access is required.';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own Super Admin access.';
  end if;

  delete from public.user_roles where user_id = target_user_id;
  insert into public.user_roles (user_id, role) values (target_user_id, new_role);
end;
$$;

revoke execute on function public.admin_set_user_role(uuid, public.app_role) from public;
grant execute on function public.admin_set_user_role(uuid, public.app_role) to authenticated;

-- Profiles and user access
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists "Super admins can manage profiles" on public.profiles;
drop policy if exists "Admins can manage roles" on public.user_roles;
drop policy if exists "Super admins can manage roles" on public.user_roles;
drop policy if exists "Admins can manage user access audit" on public.user_access_audit;
drop policy if exists "Super admins can manage user access audit" on public.user_access_audit;

create policy "Super admins can manage profiles"
on public.profiles for all to authenticated
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

create policy "Super admins can manage roles"
on public.user_roles for all to authenticated
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

create policy "Super admins can manage user access audit"
on public.user_access_audit for all to authenticated
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

-- Departments and members
drop policy if exists "Church leaders can manage departments" on public.departments;
drop policy if exists "Clerks and pastors can manage departments" on public.departments;
drop policy if exists "Department heads can update their department" on public.departments;
drop policy if exists "Department heads can manage assigned departments" on public.departments;
drop policy if exists "Elders can update departments" on public.departments;
drop policy if exists "Elders can create departments" on public.departments;
drop policy if exists "Elders can delete departments" on public.departments;
drop policy if exists "Authenticated users can view departments" on public.departments;
drop policy if exists "Authorized users can view departments" on public.departments;
drop policy if exists "Church leaders can manage members" on public.members;
drop policy if exists "Authorized leaders can manage members" on public.members;
drop policy if exists "Clerks and pastors can manage members" on public.members;
drop policy if exists "Department heads can view assigned members" on public.members;
drop policy if exists "Members can view own member profile" on public.members;
drop policy if exists "Authenticated users can view members" on public.members;
drop policy if exists "Church leaders can manage department memberships" on public.department_members;
drop policy if exists "Clerks and pastors can manage department memberships" on public.department_members;
drop policy if exists "Elders can manage department memberships" on public.department_members;
drop policy if exists "Authenticated users can view department memberships" on public.department_members;
drop policy if exists "Authorized users can view department memberships" on public.department_members;
drop policy if exists "Department heads can manage assigned department memberships" on public.department_members;

create policy "Authorized users can view departments"
on public.departments for select to authenticated
using (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[]));

create policy "Clerks pastors elders and secretaries can manage departments"
on public.departments for all to authenticated
using (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[]));

create policy "Department heads can manage assigned departments"
on public.departments for update to authenticated
using (public.has_role('department_head') and leader_id = auth.uid())
with check (public.has_role('department_head') and leader_id = auth.uid());

create policy "Clerks pastors elders and secretaries can manage members"
on public.members for all to authenticated
using (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[]));

create policy "Department heads can view assigned members"
on public.members for select to authenticated
using (public.has_role('department_head') and public.is_department_leader_for_member(id));

create policy "Members can view own member profile"
on public.members for select to authenticated
using (profile_id = auth.uid());

create policy "Authorized users can view department memberships"
on public.department_members for select to authenticated
using (
  public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[])
  or (public.has_role('department_head') and public.is_department_leader_for_department(department_id))
);

create policy "Clerks pastors elders and secretaries can manage department memberships"
on public.department_members for all to authenticated
using (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[]));

create policy "Department heads can manage assigned department memberships"
on public.department_members for all to authenticated
using (public.has_role('department_head') and public.is_department_leader_for_department(department_id))
with check (public.has_role('department_head') and public.is_department_leader_for_department(department_id));

-- Attendance
drop policy if exists "Ministry leaders can manage attendance sessions" on public.attendance_sessions;
drop policy if exists "Ministry leaders can manage attendance entries" on public.attendance_entries;
drop policy if exists "Authenticated users can view attendance sessions" on public.attendance_sessions;
drop policy if exists "Authorized users can view attendance sessions" on public.attendance_sessions;
drop policy if exists "Authenticated users can view attendance entries" on public.attendance_entries;
drop policy if exists "Authorized users can view attendance entries" on public.attendance_entries;

create policy "Authorized users can view attendance sessions"
on public.attendance_sessions for select to authenticated
using (
  public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[])
  or exists (
    select 1
    from public.attendance_entries
    join public.members on members.id = attendance_entries.member_id
    where attendance_entries.session_id = attendance_sessions.id
      and members.profile_id = auth.uid()
  )
);

create policy "Authorized users can view attendance entries"
on public.attendance_entries for select to authenticated
using (
  public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[])
  or (member_id is not null and public.has_role('department_head') and public.is_department_leader_for_member(member_id))
  or exists (
    select 1
    from public.members
    where members.id = attendance_entries.member_id
      and members.profile_id = auth.uid()
  )
);

create policy "Ministry leaders can manage attendance sessions"
on public.attendance_sessions for all to authenticated
using (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[]))
with check (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[]));

create policy "Ministry leaders can manage attendance entries"
on public.attendance_entries for all to authenticated
using (
  public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[])
  or (public.has_role('department_head') and member_id is not null and public.is_department_leader_for_member(member_id))
)
with check (
  public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[])
  or (public.has_role('department_head') and member_id is not null and public.is_department_leader_for_member(member_id))
);

-- Finance
drop policy if exists "Treasury can manage funds" on public.funds;
drop policy if exists "Treasurer can manage funds" on public.funds;
drop policy if exists "Treasury can view contribution batches" on public.contribution_batches;
drop policy if exists "Treasurer and pastor can view contribution batches" on public.contribution_batches;
drop policy if exists "Treasury can manage contribution batches" on public.contribution_batches;
drop policy if exists "Treasurer can manage contribution batches" on public.contribution_batches;
drop policy if exists "Treasury can view contributions" on public.contributions;
drop policy if exists "Treasurer and pastor can view contributions" on public.contributions;
drop policy if exists "Treasury can manage contributions" on public.contributions;
drop policy if exists "Treasurer can manage contributions" on public.contributions;

create policy "Treasurer can manage funds"
on public.funds for all to authenticated
using (public.has_role('treasurer'))
with check (public.has_role('treasurer'));

create policy "Treasurer and pastor can view contribution batches"
on public.contribution_batches for select to authenticated
using (public.has_any_role(array['pastor', 'elder', 'treasurer']::public.app_role[]));

create policy "Treasurer can manage contribution batches"
on public.contribution_batches for all to authenticated
using (public.has_role('treasurer'))
with check (public.has_role('treasurer'));

create policy "Treasurer and pastor can view contributions"
on public.contributions for select to authenticated
using (public.has_any_role(array['pastor', 'elder', 'treasurer']::public.app_role[]));

create policy "Treasurer can manage contributions"
on public.contributions for all to authenticated
using (public.has_role('treasurer'))
with check (public.has_role('treasurer'));

-- Events and announcements
drop policy if exists "Ministry leaders can manage events" on public.events;
drop policy if exists "Church leaders can manage announcements" on public.announcements;
drop policy if exists "Ministry leaders can manage announcements" on public.announcements;

create policy "Ministry leaders can manage events"
on public.events for all to authenticated
using (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[]))
with check (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[]));

create policy "Ministry leaders can manage announcements"
on public.announcements for all to authenticated
using (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[]))
with check (public.has_any_role(array['pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[]));

-- Member photos
drop policy if exists "Authorized users can insert member photos" on storage.objects;
drop policy if exists "Authorized users can update member photos" on storage.objects;
drop policy if exists "Authorized users can delete member photos" on storage.objects;

create policy "Authorized users can insert member photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-photos'
  and public.member_photo_member_id(name) is not null
  and public.can_manage_member_photo(name)
);

create policy "Authorized users can update member photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'member-photos'
  and public.member_photo_member_id(name) is not null
  and public.can_manage_member_photo(name)
)
with check (
  bucket_id = 'member-photos'
  and public.member_photo_member_id(name) is not null
  and public.can_manage_member_photo(name)
);

create policy "Authorized users can delete member photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-photos'
  and public.member_photo_member_id(name) is not null
  and public.can_manage_member_photo(name)
);

create or replace view public.user_profiles
with (security_invoker = true)
as
select
  id,
  full_name,
  email,
  phone,
  avatar_url,
  is_active,
  created_at,
  updated_at
from public.profiles
where id = auth.uid()
   or public.has_role('super_admin');
