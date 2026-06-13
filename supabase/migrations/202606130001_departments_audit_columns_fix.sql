begin;

alter table public.departments
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

create index if not exists departments_created_by_idx
on public.departments (created_by)
where created_by is not null;

create index if not exists departments_updated_by_idx
on public.departments (updated_by)
where updated_by is not null;

grant select, insert, update on public.departments to authenticated;

commit;
