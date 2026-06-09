-- Attendance Module for Hamburg Ghana SDA Church.
-- Adds database-driven attendance categories, individual member/visitor records,
-- reporting indexes, and role-aware RLS policies.

do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumlabel = 'late'
      and enumtypid = 'public.attendance_status'::regtype
  ) then
    alter type public.attendance_status add value 'late';
  end if;

  if not exists (
    select 1 from pg_enum
    where enumlabel = 'excused'
      and enumtypid = 'public.attendance_status'::regtype
  ) then
    alter type public.attendance_status add value 'excused';
  end if;
end $$;

create table if not exists public.attendance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.attendance_sessions
  add column if not exists attendance_category_id uuid references public.attendance_categories(id) on delete set null,
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.attendance_entries
  add column if not exists department_id uuid references public.departments(id) on delete set null,
  add column if not exists notes text,
  add column if not exists recorded_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

drop trigger if exists attendance_categories_set_updated_at on public.attendance_categories;
create trigger attendance_categories_set_updated_at
before update on public.attendance_categories
for each row execute function public.set_updated_at();

drop trigger if exists attendance_entries_set_updated_at on public.attendance_entries;
create trigger attendance_entries_set_updated_at
before update on public.attendance_entries
for each row execute function public.set_updated_at();

create index if not exists attendance_categories_active_idx
on public.attendance_categories (is_active, sort_order, name);

create index if not exists attendance_sessions_category_date_idx
on public.attendance_sessions (attendance_category_id, service_date desc);

create index if not exists attendance_sessions_department_date_idx
on public.attendance_sessions (department_id, service_date desc);

create index if not exists attendance_entries_member_status_idx
on public.attendance_entries (member_id, status);

create index if not exists attendance_entries_department_idx
on public.attendance_entries (department_id);

create or replace function public.can_manage_attendance()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'pastor', 'elder', 'secretary', 'church_clerk', 'department_head']::public.app_role[]);
$$;

create or replace function public.can_view_attendance_reports()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'pastor', 'elder', 'secretary', 'church_clerk', 'department_head']::public.app_role[]);
$$;

insert into public.attendance_categories (name, slug, description, sort_order, is_active)
values
  ('Sabbath Worship', 'sabbath-worship', 'Main Sabbath divine worship attendance.', 10, true),
  ('Sabbath School', 'sabbath-school', 'Sabbath School class and lesson study attendance.', 20, true),
  ('Prayer Meeting', 'prayer-meeting', 'Midweek prayer meeting attendance.', 30, true),
  ('Youth Meeting', 'youth-meeting', 'Youth ministry meeting attendance.', 40, true),
  ('Department Meeting', 'department-meeting', 'Department-specific ministry meeting attendance.', 50, true),
  ('Visitors', 'visitors', 'Visitor attendance and follow-up records.', 60, true)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

alter table public.attendance_categories enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_entries enable row level security;

drop policy if exists "Authenticated users can view active attendance categories" on public.attendance_categories;
create policy "Authenticated users can view active attendance categories"
on public.attendance_categories for select to authenticated
using (is_active or public.can_manage_attendance());

drop policy if exists "Attendance managers can manage attendance categories" on public.attendance_categories;
create policy "Attendance managers can manage attendance categories"
on public.attendance_categories for all to authenticated
using (public.can_manage_attendance())
with check (public.can_manage_attendance());

drop policy if exists "Authenticated users can view attendance sessions" on public.attendance_sessions;
drop policy if exists "Authorized users can view attendance sessions" on public.attendance_sessions;
create policy "Authorized users can view attendance sessions"
on public.attendance_sessions for select to authenticated
using (
  public.can_view_attendance_reports()
  or exists (
    select 1
    from public.attendance_entries
    join public.members on members.id = attendance_entries.member_id
    where attendance_entries.session_id = attendance_sessions.id
      and members.profile_id = auth.uid()
  )
);

drop policy if exists "Ministry leaders can manage attendance sessions" on public.attendance_sessions;
create policy "Attendance managers can manage attendance sessions"
on public.attendance_sessions for all to authenticated
using (public.can_manage_attendance())
with check (public.can_manage_attendance());

drop policy if exists "Authenticated users can view attendance entries" on public.attendance_entries;
drop policy if exists "Authorized users can view attendance entries" on public.attendance_entries;
create policy "Authorized users can view attendance entries"
on public.attendance_entries for select to authenticated
using (
  public.can_view_attendance_reports()
  or exists (
    select 1
    from public.members
    where members.id = attendance_entries.member_id
      and members.profile_id = auth.uid()
  )
);

drop policy if exists "Ministry leaders can manage attendance entries" on public.attendance_entries;
create policy "Attendance managers can manage attendance entries"
on public.attendance_entries for all to authenticated
using (public.can_manage_attendance())
with check (public.can_manage_attendance());

grant select, insert, update on public.attendance_categories to authenticated;
grant select, insert, update, delete on public.attendance_sessions to authenticated;
grant select, insert, update, delete on public.attendance_entries to authenticated;
grant execute on function public.can_manage_attendance() to authenticated;
grant execute on function public.can_view_attendance_reports() to authenticated;
