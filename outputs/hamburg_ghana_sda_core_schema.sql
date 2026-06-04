-- Hamburg Ghana SDA Church Management System
-- Core Supabase schema for manual execution in the Supabase SQL Editor.
-- Covers: users, roles, members, departments, attendance, tithe, offerings.
-- Intended for a fresh Supabase project. After a successful bootstrap it can
-- be rerun to refresh triggers, seed records, and policies without deleting
-- existing church data. Use incremental migrations to upgrade older schemas.

begin;

create extension if not exists pgcrypto;

do $$ begin
  create type public.app_role as enum (
    'admin', 'pastor', 'elder', 'treasurer', 'secretary',
    'department_head', 'member'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.member_status as enum (
    'active', 'inactive', 'transferred', 'deceased'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.gender as enum (
    'male', 'female', 'other', 'prefer_not_to_say'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.marital_status as enum (
    'single', 'married', 'divorced', 'widowed', 'other'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.attendance_status as enum (
    'present', 'absent', 'visitor'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.attendance_service as enum (
    'sabbath_school', 'divine_service', 'midweek_prayer_meeting',
    'youth_program', 'special_event'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.contribution_type as enum (
    'tithe', 'offering', 'building_fund', 'missions',
    'thanksgiving_offering', 'special_donation', 'welfare', 'other'
  );
exception when duplicate_object then
  alter type public.contribution_type add value if not exists 'thanksgiving_offering';
  alter type public.contribution_type add value if not exists 'special_donation';
end $$;

do $$ begin
  create type public.payment_method as enum (
    'cash', 'bank_transfer', 'card', 'mobile_money', 'other'
  );
exception when duplicate_object then null;
end $$;

-- Users and roles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Departments and members
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  leader_id uuid references public.profiles(id) on delete set null,
  meeting_schedule text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  member_number text not null unique,
  profile_id uuid unique references public.profiles(id) on delete set null,
  first_name text not null,
  last_name text not null,
  full_name text not null,
  gender public.gender,
  date_of_birth date,
  phone text,
  email text,
  address_line text,
  postal_code text,
  city text default 'Hamburg',
  country text default 'Germany',
  baptism_status boolean not null default false,
  baptism_date date,
  marital_status public.marital_status,
  occupation text,
  joined_on date,
  status public.member_status not null default 'active',
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.department_members (
  department_id uuid not null references public.departments(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  is_department_head boolean not null default false,
  joined_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (department_id, member_id)
);

-- Attendance
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  service_type public.attendance_service not null default 'divine_service',
  service_date date not null,
  starts_at time,
  adult_count integer not null default 0 check (adult_count >= 0),
  child_count integer not null default 0 check (child_count >= 0),
  visitor_count integer not null default 0 check (visitor_count >= 0),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_name, service_date)
);

create table if not exists public.attendance_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  visitor_name text,
  status public.attendance_status not null default 'present',
  checked_in_at timestamptz not null default now(),
  check (
    (member_id is not null and visitor_name is null)
    or (member_id is null and visitor_name is not null)
  )
);

-- Tithe and offerings
create table if not exists public.funds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contribution_type public.contribution_type not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contribution_batches (
  id uuid primary key default gen_random_uuid(),
  batch_date date not null,
  reference text unique,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.contribution_batches(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  fund_id uuid not null references public.funds(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  contribution_date date not null,
  payment_method public.payment_method not null default 'cash',
  receipt_number text unique,
  source_name text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Automatically create an application profile and Member role for new Auth users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, '')
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email;

  insert into public.user_roles (user_id, role)
  values (new.id, 'member')
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Keep modified records auditable.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_departments_updated_at on public.departments;
create trigger set_departments_updated_at before update on public.departments
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_members_updated_at on public.members;
create trigger set_members_updated_at before update on public.members
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_attendance_sessions_updated_at on public.attendance_sessions;
create trigger set_attendance_sessions_updated_at before update on public.attendance_sessions
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_funds_updated_at on public.funds;
create trigger set_funds_updated_at before update on public.funds
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_contribution_batches_updated_at on public.contribution_batches;
create trigger set_contribution_batches_updated_at before update on public.contribution_batches
  for each row execute procedure public.set_updated_at();
drop trigger if exists set_contributions_updated_at on public.contributions;
create trigger set_contributions_updated_at before update on public.contributions
  for each row execute procedure public.set_updated_at();

-- Useful indexes
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists user_roles_role_idx on public.user_roles (role);
create index if not exists departments_leader_id_idx on public.departments (leader_id);
create index if not exists members_full_name_idx on public.members (lower(full_name));
create index if not exists members_last_name_first_name_idx on public.members (lower(last_name), lower(first_name));
create index if not exists members_status_idx on public.members (status);
create index if not exists department_members_member_id_idx on public.department_members (member_id);
create index if not exists attendance_sessions_service_date_idx on public.attendance_sessions (service_date desc);
create index if not exists attendance_entries_session_id_idx on public.attendance_entries (session_id);
create unique index if not exists attendance_entries_one_member_per_session
  on public.attendance_entries (session_id, member_id)
  where member_id is not null;
create index if not exists contributions_date_idx on public.contributions (contribution_date desc);
create index if not exists contributions_member_id_idx on public.contributions (member_id);
create index if not exists contributions_fund_id_idx on public.contributions (fund_id);

-- Default SDA departments
insert into public.departments (name, description)
values
  ('Elders', 'Spiritual leadership and pastoral support'),
  ('Deacons', 'Church service, hospitality, and practical support'),
  ('Deaconesses', 'Member care, hospitality, and church support'),
  ('Treasury', 'Financial stewardship and reporting'),
  ('Secretariat', 'Church records and administration'),
  ('Sabbath School', 'Bible study and Sabbath School coordination'),
  ('Youth Ministry', 'Programs and discipleship for youth and young adults'),
  ('Women''s Ministry', 'Ministry and fellowship for women'),
  ('Men''s Ministry', 'Ministry and fellowship for men'),
  ('Pathfinder Club', 'Youth development and Pathfinder activities'),
  ('Adventurer Club', 'Faith-based activities for younger children'),
  ('Choir', 'Worship music and choir ministry'),
  ('Media Ministry', 'Audio, visual, streaming, and communications support'),
  ('Children''s Ministry', 'Programs and spiritual support for children'),
  ('Personal Ministries', 'Evangelism, outreach, and personal ministry')
on conflict (name) do nothing;

-- Default tithe and offering categories
insert into public.funds (name, contribution_type, description)
values
  ('Tithe', 'tithe', 'Regular tithe contributions'),
  ('Sabbath Offering', 'offering', 'Regular Sabbath worship offering'),
  ('Building Fund', 'building_fund', 'Church building and facilities fund'),
  ('Mission Offering', 'missions', 'Mission and evangelism support'),
  ('Thanksgiving Offering', 'thanksgiving_offering', 'Thanksgiving gifts and offerings'),
  ('Special Donation', 'special_donation', 'Special gifts and designated donations')
on conflict (name) do nothing;

-- Role helpers
create or replace function public.has_role(requested_role public.app_role)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = requested_role
  );
$$;

create or replace function public.has_any_role(requested_roles public.app_role[])
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = any(requested_roles)
  );
$$;

revoke execute on function public.has_role(public.app_role) from public;
revoke execute on function public.has_any_role(public.app_role[]) from public;
grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;

-- PostgreSQL privileges. RLS policies below decide which rows each role can use.
grant usage on schema public to authenticated;
grant usage on type public.app_role to authenticated;
grant usage on type public.member_status to authenticated;
grant usage on type public.gender to authenticated;
grant usage on type public.marital_status to authenticated;
grant usage on type public.attendance_status to authenticated;
grant usage on type public.attendance_service to authenticated;
grant usage on type public.contribution_type to authenticated;
grant usage on type public.payment_method to authenticated;
grant select, insert, update, delete on table
  public.profiles,
  public.user_roles,
  public.departments,
  public.members,
  public.department_members,
  public.attendance_sessions,
  public.attendance_entries,
  public.funds,
  public.contribution_batches,
  public.contributions
to authenticated;

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

-- Refresh policies so rerunning the script updates security rules.
drop policy if exists "Authenticated users can view profiles" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists "Users can view their own roles" on public.user_roles;
drop policy if exists "Admins can manage roles" on public.user_roles;
drop policy if exists "Authenticated users can view departments" on public.departments;
drop policy if exists "Church leaders can manage departments" on public.departments;
drop policy if exists "Department heads can update their department" on public.departments;
drop policy if exists "Elders can update departments" on public.departments;
drop policy if exists "Elders can create departments" on public.departments;
drop policy if exists "Elders can delete departments" on public.departments;
drop policy if exists "Authenticated users can view members" on public.members;
drop policy if exists "Church leaders can manage members" on public.members;
drop policy if exists "Authenticated users can view department memberships" on public.department_members;
drop policy if exists "Church leaders can manage department memberships" on public.department_members;
drop policy if exists "Elders can manage department memberships" on public.department_members;
drop policy if exists "Authenticated users can view attendance sessions" on public.attendance_sessions;
drop policy if exists "Ministry leaders can manage attendance sessions" on public.attendance_sessions;
drop policy if exists "Authenticated users can view attendance entries" on public.attendance_entries;
drop policy if exists "Ministry leaders can manage attendance entries" on public.attendance_entries;
drop policy if exists "Authenticated users can view active funds" on public.funds;
drop policy if exists "Treasury can manage funds" on public.funds;
drop policy if exists "Treasury can view contribution batches" on public.contribution_batches;
drop policy if exists "Treasury can manage contribution batches" on public.contribution_batches;
drop policy if exists "Treasury can view contributions" on public.contributions;
drop policy if exists "Treasury can manage contributions" on public.contributions;

create policy "Authenticated users can view profiles"
  on public.profiles for select to authenticated using (true);
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "Admins can manage profiles"
  on public.profiles for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "Users can view their own roles"
  on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Admins can manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role('admin')) with check (public.has_role('admin'));

create policy "Authenticated users can view departments"
  on public.departments for select to authenticated using (true);
create policy "Church leaders can manage departments"
  on public.departments for all to authenticated
  using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));
create policy "Department heads can update their department"
  on public.departments for update to authenticated
  using (leader_id = auth.uid()) with check (leader_id = auth.uid());
create policy "Elders can update departments"
  on public.departments for update to authenticated
  using (public.has_role('elder')) with check (public.has_role('elder'));
create policy "Elders can create departments"
  on public.departments for insert to authenticated with check (public.has_role('elder'));
create policy "Elders can delete departments"
  on public.departments for delete to authenticated using (public.has_role('elder'));

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
  using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));
create policy "Elders can manage department memberships"
  on public.department_members for all to authenticated
  using (public.has_role('elder')) with check (public.has_role('elder'));

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

create policy "Authenticated users can view active funds"
  on public.funds for select to authenticated
  using (is_active or public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
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

commit;

-- After creating your first Supabase Auth user, make that user an Admin:
--
-- insert into public.user_roles (user_id, role)
-- select id, 'admin'::public.app_role
-- from auth.users
-- where email = 'your-admin-email@example.com'
-- on conflict do nothing;
