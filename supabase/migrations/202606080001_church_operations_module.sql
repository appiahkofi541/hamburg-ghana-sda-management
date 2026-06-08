-- Church Operations Module for Hamburg Ghana SDA Church.
-- Tracks visitors, baptism candidates, child dedications, marriages, funerals,
-- membership transfers, prayer follow-up, pastoral visits, sick member care,
-- and calendar-linked operations.

create table if not exists public.church_operation_records (
  id uuid primary key default gen_random_uuid(),
  operation_type text not null check (operation_type in (
    'visitor',
    'baptism_candidate',
    'child_dedication',
    'marriage',
    'funeral',
    'membership_transfer',
    'prayer_tracking',
    'pastoral_visit',
    'sick_member',
    'calendar_integration'
  )),
  title text not null,
  primary_name text,
  contact_info text,
  status text not null default 'new',
  record_date date not null default current_date,
  follow_up_date date,
  notes text,
  details jsonb not null default '{}'::jsonb,
  member_id uuid references public.members(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_church_operation_records_updated_at on public.church_operation_records;
create trigger set_church_operation_records_updated_at
before update on public.church_operation_records
for each row execute function public.set_updated_at();

create index if not exists church_operation_records_type_idx
on public.church_operation_records (operation_type);

create index if not exists church_operation_records_status_idx
on public.church_operation_records (status);

create index if not exists church_operation_records_follow_up_idx
on public.church_operation_records (follow_up_date)
where follow_up_date is not null;

create index if not exists church_operation_records_event_idx
on public.church_operation_records (event_id)
where event_id is not null;

alter table public.church_operation_records enable row level security;

drop policy if exists "Church leaders can view operation records" on public.church_operation_records;
drop policy if exists "Church leaders can manage operation records" on public.church_operation_records;

create policy "Church leaders can view operation records"
on public.church_operation_records for select to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[])
);

create policy "Church leaders can manage operation records"
on public.church_operation_records for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'church_clerk', 'secretary']::public.app_role[])
);

grant select, insert, update, delete on public.church_operation_records to authenticated;

insert into public.church_operation_records (operation_type, title, primary_name, contact_info, status, record_date, follow_up_date, notes, details)
values
  ('visitor', 'First-time visitor follow-up', 'Sample Visitor', '+49 170 000000', 'new', current_date, current_date + interval '7 days', 'Demo record for visitor follow-up workflow.', '{"Visit source":"Sabbath Service","Assigned follow-up leader":"Elder on duty"}'::jsonb),
  ('baptism_candidate', 'Baptism candidate Bible study', 'Sample Candidate', 'candidate@example.com', 'bible_study', current_date, current_date + interval '14 days', 'Demo baptism candidate progress record.', '{"Bible study progress":"Lesson 4 of 12","Baptism date":""}'::jsonb)
on conflict do nothing;
