-- Baptism & Membership Transfer module for Hamburg Ghana SDA Church.
-- Creates structured records for baptism candidates, classes, baptism records,
-- membership transfers, and professions of faith.

create table if not exists public.baptism_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_id text not null unique,
  full_name text not null,
  date_of_birth date,
  gender text,
  phone_number text,
  address text,
  bible_instructor text,
  baptismal_class_start_date date,
  status text not null default 'studying' check (status in ('studying', 'ready_for_baptism', 'baptized')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.baptism_classes (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  instructor text,
  start_date date,
  end_date date,
  lessons_completed integer not null default 0 check (lessons_completed >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.baptism_records (
  id uuid primary key default gen_random_uuid(),
  baptism_date date not null,
  pastor text not null,
  location text,
  candidate_record_id uuid references public.baptism_candidates(id) on delete set null,
  candidate_name text,
  witnesses text,
  certificate_number text not null unique,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_transfer_in (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  previous_church text not null,
  conference text,
  request_date date,
  transfer_received_date date,
  status text not null default 'requested',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.membership_transfer_out (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  destination_church text not null,
  conference text,
  request_date date,
  approval_date date,
  status text not null default 'requested',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profession_of_faith_records (
  id uuid primary key default gen_random_uuid(),
  member_name text not null,
  profession_date date not null,
  pastor text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists baptism_candidates_set_updated_at on public.baptism_candidates;
create trigger baptism_candidates_set_updated_at
before update on public.baptism_candidates
for each row execute function public.set_updated_at();

drop trigger if exists baptism_classes_set_updated_at on public.baptism_classes;
create trigger baptism_classes_set_updated_at
before update on public.baptism_classes
for each row execute function public.set_updated_at();

drop trigger if exists baptism_records_set_updated_at on public.baptism_records;
create trigger baptism_records_set_updated_at
before update on public.baptism_records
for each row execute function public.set_updated_at();

drop trigger if exists membership_transfer_in_set_updated_at on public.membership_transfer_in;
create trigger membership_transfer_in_set_updated_at
before update on public.membership_transfer_in
for each row execute function public.set_updated_at();

drop trigger if exists membership_transfer_out_set_updated_at on public.membership_transfer_out;
create trigger membership_transfer_out_set_updated_at
before update on public.membership_transfer_out
for each row execute function public.set_updated_at();

drop trigger if exists profession_of_faith_records_set_updated_at on public.profession_of_faith_records;
create trigger profession_of_faith_records_set_updated_at
before update on public.profession_of_faith_records
for each row execute function public.set_updated_at();

create index if not exists baptism_candidates_status_idx on public.baptism_candidates (status, created_at desc);
create index if not exists baptism_candidates_name_idx on public.baptism_candidates (lower(full_name));
create index if not exists baptism_classes_start_idx on public.baptism_classes (start_date desc);
create index if not exists baptism_records_date_idx on public.baptism_records (baptism_date desc);
create index if not exists baptism_records_candidate_idx on public.baptism_records (candidate_record_id);
create index if not exists membership_transfer_in_status_idx on public.membership_transfer_in (status, request_date desc);
create index if not exists membership_transfer_out_status_idx on public.membership_transfer_out (status, request_date desc);
create index if not exists profession_of_faith_date_idx on public.profession_of_faith_records (profession_date desc);

create or replace function public.can_manage_baptism_transfers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[]);
$$;

create or replace function public.can_view_baptism_transfers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary', 'department_head']::public.app_role[]);
$$;

alter table public.baptism_candidates enable row level security;
alter table public.baptism_classes enable row level security;
alter table public.baptism_records enable row level security;
alter table public.membership_transfer_in enable row level security;
alter table public.membership_transfer_out enable row level security;
alter table public.profession_of_faith_records enable row level security;

drop policy if exists "Baptism transfer viewers can view candidates" on public.baptism_candidates;
create policy "Baptism transfer viewers can view candidates"
on public.baptism_candidates for select to authenticated
using (public.can_view_baptism_transfers());

drop policy if exists "Baptism transfer managers can manage candidates" on public.baptism_candidates;
create policy "Baptism transfer managers can manage candidates"
on public.baptism_candidates for all to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view classes" on public.baptism_classes;
create policy "Baptism transfer viewers can view classes"
on public.baptism_classes for select to authenticated
using (public.can_view_baptism_transfers());

drop policy if exists "Baptism transfer managers can manage classes" on public.baptism_classes;
create policy "Baptism transfer managers can manage classes"
on public.baptism_classes for all to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view baptism records" on public.baptism_records;
create policy "Baptism transfer viewers can view baptism records"
on public.baptism_records for select to authenticated
using (public.can_view_baptism_transfers());

drop policy if exists "Baptism transfer managers can manage baptism records" on public.baptism_records;
create policy "Baptism transfer managers can manage baptism records"
on public.baptism_records for all to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view transfer in" on public.membership_transfer_in;
create policy "Baptism transfer viewers can view transfer in"
on public.membership_transfer_in for select to authenticated
using (public.can_view_baptism_transfers());

drop policy if exists "Baptism transfer managers can manage transfer in" on public.membership_transfer_in;
create policy "Baptism transfer managers can manage transfer in"
on public.membership_transfer_in for all to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view transfer out" on public.membership_transfer_out;
create policy "Baptism transfer viewers can view transfer out"
on public.membership_transfer_out for select to authenticated
using (public.can_view_baptism_transfers());

drop policy if exists "Baptism transfer managers can manage transfer out" on public.membership_transfer_out;
create policy "Baptism transfer managers can manage transfer out"
on public.membership_transfer_out for all to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer viewers can view professions of faith" on public.profession_of_faith_records;
create policy "Baptism transfer viewers can view professions of faith"
on public.profession_of_faith_records for select to authenticated
using (public.can_view_baptism_transfers());

drop policy if exists "Baptism transfer managers can manage professions of faith" on public.profession_of_faith_records;
create policy "Baptism transfer managers can manage professions of faith"
on public.profession_of_faith_records for all to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

grant select, insert, update, delete on
  public.baptism_candidates,
  public.baptism_classes,
  public.baptism_records,
  public.membership_transfer_in,
  public.membership_transfer_out,
  public.profession_of_faith_records
to authenticated;

grant execute on function public.can_manage_baptism_transfers() to authenticated;
grant execute on function public.can_view_baptism_transfers() to authenticated;

insert into public.baptism_candidates (
  candidate_id,
  full_name,
  date_of_birth,
  gender,
  phone_number,
  address,
  bible_instructor,
  baptismal_class_start_date,
  status,
  notes
)
select
  'BC-2026-001',
  'Ama Nyarko',
  '1999-04-18',
  'Female',
  '+49 176 000 1020',
  'Hamburg, Germany',
  'Pastor Mensah',
  '2026-07-04',
  'studying',
  'Demo baptism candidate for testing.'
where not exists (select 1 from public.baptism_candidates);
