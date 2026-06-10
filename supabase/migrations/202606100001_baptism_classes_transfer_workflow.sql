-- Expand Baptism & Membership Transfer workflows.
-- Adds class candidate assignments, class attendance, transfer approval metadata,
-- transfer letter storage policies, and baptism-to-member linkage.

alter table public.baptism_records
  add column if not exists member_id uuid references public.members(id) on delete set null;

alter table public.membership_transfer_in
  add column if not exists transfer_letter_url text,
  add column if not exists transfer_letter_path text,
  add column if not exists approval_status text not null default 'requested',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

alter table public.membership_transfer_out
  add column if not exists transfer_request_url text,
  add column if not exists transfer_request_path text,
  add column if not exists approval_status text not null default 'requested',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

create table if not exists public.baptism_class_candidates (
  class_id uuid not null references public.baptism_classes(id) on delete cascade,
  candidate_id uuid not null references public.baptism_candidates(id) on delete cascade,
  progress_status text not null default 'studying',
  lessons_completed integer not null default 0 check (lessons_completed >= 0),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (class_id, candidate_id)
);

create table if not exists public.baptism_class_attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.baptism_classes(id) on delete cascade,
  candidate_id uuid not null references public.baptism_candidates(id) on delete cascade,
  attendance_date date not null default current_date,
  status text not null default 'present' check (status in ('present', 'absent', 'late', 'excused')),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, candidate_id, attendance_date)
);

drop trigger if exists baptism_class_candidates_set_updated_at on public.baptism_class_candidates;
create trigger baptism_class_candidates_set_updated_at
before update on public.baptism_class_candidates
for each row execute function public.set_updated_at();

drop trigger if exists baptism_class_attendance_set_updated_at on public.baptism_class_attendance;
create trigger baptism_class_attendance_set_updated_at
before update on public.baptism_class_attendance
for each row execute function public.set_updated_at();

create index if not exists baptism_class_candidates_candidate_idx
on public.baptism_class_candidates (candidate_id);

create index if not exists baptism_class_attendance_class_date_idx
on public.baptism_class_attendance (class_id, attendance_date desc);

create index if not exists baptism_records_member_idx
on public.baptism_records (member_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transfer-letters',
  'transfer-letters',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

alter table public.baptism_class_candidates enable row level security;
alter table public.baptism_class_attendance enable row level security;

drop policy if exists "Baptism transfer leaders can select class candidates" on public.baptism_class_candidates;
drop policy if exists "Baptism transfer leaders can insert class candidates" on public.baptism_class_candidates;
drop policy if exists "Baptism transfer leaders can update class candidates" on public.baptism_class_candidates;
drop policy if exists "Baptism transfer leaders can delete class candidates" on public.baptism_class_candidates;

create policy "Baptism transfer leaders can select class candidates"
on public.baptism_class_candidates for select to authenticated
using (public.can_view_baptism_transfers());

create policy "Baptism transfer leaders can insert class candidates"
on public.baptism_class_candidates for insert to authenticated
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can update class candidates"
on public.baptism_class_candidates for update to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can delete class candidates"
on public.baptism_class_candidates for delete to authenticated
using (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer leaders can select class attendance" on public.baptism_class_attendance;
drop policy if exists "Baptism transfer leaders can insert class attendance" on public.baptism_class_attendance;
drop policy if exists "Baptism transfer leaders can update class attendance" on public.baptism_class_attendance;
drop policy if exists "Baptism transfer leaders can delete class attendance" on public.baptism_class_attendance;

create policy "Baptism transfer leaders can select class attendance"
on public.baptism_class_attendance for select to authenticated
using (public.can_view_baptism_transfers());

create policy "Baptism transfer leaders can insert class attendance"
on public.baptism_class_attendance for insert to authenticated
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can update class attendance"
on public.baptism_class_attendance for update to authenticated
using (public.can_manage_baptism_transfers())
with check (public.can_manage_baptism_transfers());

create policy "Baptism transfer leaders can delete class attendance"
on public.baptism_class_attendance for delete to authenticated
using (public.can_manage_baptism_transfers());

drop policy if exists "Baptism transfer leaders can upload transfer letters" on storage.objects;
drop policy if exists "Baptism transfer leaders can view transfer letters" on storage.objects;
drop policy if exists "Baptism transfer leaders can update transfer letters" on storage.objects;
drop policy if exists "Baptism transfer leaders can delete transfer letters" on storage.objects;

create policy "Baptism transfer leaders can upload transfer letters"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'transfer-letters'
  and public.can_manage_baptism_transfers()
);

create policy "Baptism transfer leaders can view transfer letters"
on storage.objects for select to authenticated
using (
  bucket_id = 'transfer-letters'
  and public.can_view_baptism_transfers()
);

create policy "Baptism transfer leaders can update transfer letters"
on storage.objects for update to authenticated
using (
  bucket_id = 'transfer-letters'
  and public.can_manage_baptism_transfers()
)
with check (
  bucket_id = 'transfer-letters'
  and public.can_manage_baptism_transfers()
);

create policy "Baptism transfer leaders can delete transfer letters"
on storage.objects for delete to authenticated
using (
  bucket_id = 'transfer-letters'
  and public.can_manage_baptism_transfers()
);

grant select, insert, update, delete on
  public.baptism_class_candidates,
  public.baptism_class_attendance
to authenticated;
