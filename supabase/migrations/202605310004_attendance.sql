-- Attendance supports service totals as well as optional individual check-in.
create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  service_name text not null,
  service_date date not null,
  starts_at time,
  notes text,
  adult_count integer not null default 0 check (adult_count >= 0),
  child_count integer not null default 0 check (child_count >= 0),
  visitor_count integer not null default 0 check (visitor_count >= 0),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_name, service_date)
);

create table public.attendance_entries (
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

create unique index attendance_entries_one_member_per_session
  on public.attendance_entries (session_id, member_id)
  where member_id is not null;
