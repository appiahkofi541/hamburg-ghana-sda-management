-- Visitor Management module for Hamburg Ghana SDA Church.

create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  visitor_number text not null unique,
  full_name text not null,
  gender text,
  date_of_birth date,
  phone text,
  email text,
  address text,
  occupation text,
  invited_by text,
  visit_date date not null default current_date,
  notes text,
  follow_up_assigned_to uuid references public.profiles(id) on delete set null,
  follow_up_status text not null default 'pending' check (follow_up_status in ('pending', 'contacted', 'scheduled', 'completed', 'not_interested')),
  follow_up_notes text,
  next_follow_up_date date,
  converted_member_id uuid references public.members(id) on delete set null,
  converted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visitor_attendance (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.visitors(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  attendance_date date not null default current_date,
  event_name text,
  check_in_at timestamptz,
  check_out_at timestamptz,
  checkin_method text not null default 'manual' check (checkin_method in ('manual', 'qr_code')),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists visitors_set_updated_at on public.visitors;
create trigger visitors_set_updated_at
before update on public.visitors
for each row execute function public.set_updated_at();

drop trigger if exists visitor_attendance_set_updated_at on public.visitor_attendance;
create trigger visitor_attendance_set_updated_at
before update on public.visitor_attendance
for each row execute function public.set_updated_at();

create index if not exists visitors_visit_date_idx on public.visitors (visit_date desc);
create index if not exists visitors_follow_up_idx on public.visitors (follow_up_status, next_follow_up_date);
create index if not exists visitors_converted_member_idx on public.visitors (converted_member_id);
create index if not exists visitor_attendance_visitor_idx on public.visitor_attendance (visitor_id, attendance_date desc);
create index if not exists visitor_attendance_event_idx on public.visitor_attendance (event_id);

create or replace function public.can_view_visitors()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[]);
$$;

create or replace function public.can_manage_visitors()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'secretary']::public.app_role[]);
$$;

create or replace function public.can_follow_up_visitors()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[]);
$$;

alter table public.visitors enable row level security;
alter table public.visitor_attendance enable row level security;

drop policy if exists "Visitor viewers can view visitors" on public.visitors;
create policy "Visitor viewers can view visitors"
on public.visitors for select to authenticated
using (public.can_view_visitors());

drop policy if exists "Visitor managers can insert visitors" on public.visitors;
create policy "Visitor managers can insert visitors"
on public.visitors for insert to authenticated
with check (public.can_manage_visitors());

drop policy if exists "Visitor follow up users can update visitors" on public.visitors;
create policy "Visitor follow up users can update visitors"
on public.visitors for update to authenticated
using (public.can_follow_up_visitors())
with check (public.can_follow_up_visitors());

drop policy if exists "Visitor managers can delete visitors" on public.visitors;
create policy "Visitor managers can delete visitors"
on public.visitors for delete to authenticated
using (public.can_manage_visitors());

drop policy if exists "Visitor viewers can view attendance" on public.visitor_attendance;
create policy "Visitor viewers can view attendance"
on public.visitor_attendance for select to authenticated
using (public.can_view_visitors());

drop policy if exists "Visitor managers can manage attendance" on public.visitor_attendance;
create policy "Visitor managers can manage attendance"
on public.visitor_attendance for all to authenticated
using (public.can_manage_visitors())
with check (public.can_manage_visitors());

grant select, insert, update, delete on public.visitors, public.visitor_attendance to authenticated;
grant execute on function public.can_view_visitors() to authenticated;
grant execute on function public.can_manage_visitors() to authenticated;
grant execute on function public.can_follow_up_visitors() to authenticated;

insert into public.visitors (
  visitor_number,
  full_name,
  gender,
  phone,
  email,
  address,
  occupation,
  invited_by,
  visit_date,
  follow_up_status,
  next_follow_up_date,
  notes
)
values
  ('VIS-2026-001', 'Nana Yeboah', 'Male', '+49 176 700 2011', 'nana.yeboah@example.com', 'Hamburg, Germany', 'Student', 'Akosua Boateng', current_date - interval '7 days', 'contacted', current_date + interval '3 days', 'Interested in Sabbath School.'),
  ('VIS-2026-002', 'Abena Sarpong', 'Female', '+49 157 884 2290', 'abena.sarpong@example.com', 'Hamburg, Germany', 'Nurse', 'Grace Appiah', current_date, 'pending', current_date + interval '5 days', 'First visit after community outreach.')
on conflict (visitor_number) do nothing;
