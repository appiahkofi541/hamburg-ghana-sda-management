begin;

alter table public.departments
  add column if not exists ministry_group_id uuid references public.record_settings(id) on delete set null;

create index if not exists departments_ministry_group_idx
on public.departments (ministry_group_id)
where ministry_group_id is not null;

grant select, insert, update on public.departments to authenticated;

commit;
