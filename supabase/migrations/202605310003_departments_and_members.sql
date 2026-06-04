-- Members are church records and do not require an application login.
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  leader_id uuid references public.profiles(id) on delete set null,
  meeting_schedule text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  member_number text not null unique,
  profile_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  address_line text,
  postal_code text,
  city text default 'Hamburg',
  country text default 'Germany',
  date_of_birth date,
  joined_on date,
  baptism_date date,
  status public.member_status not null default 'active',
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.department_members (
  department_id uuid not null references public.departments(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  is_department_head boolean not null default false,
  joined_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (department_id, member_id)
);
