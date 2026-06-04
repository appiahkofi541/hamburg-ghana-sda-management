-- Expand member records for the full membership management workflow.
create type public.gender as enum ('male', 'female', 'other', 'prefer_not_to_say');
create type public.marital_status as enum ('single', 'married', 'divorced', 'widowed', 'other');

alter table public.members
  add column first_name text,
  add column last_name text,
  add column gender public.gender,
  add column marital_status public.marital_status,
  add column occupation text;

update public.members
set
  first_name = split_part(full_name, ' ', 1),
  last_name = case
    when position(' ' in full_name) > 0 then substring(full_name from position(' ' in full_name) + 1)
    else ''
  end
where first_name is null or last_name is null;

alter table public.members
  alter column first_name set not null,
  alter column last_name set not null;

create index members_last_name_first_name_idx on public.members (lower(last_name), lower(first_name));

grant usage on type public.gender to authenticated;
grant usage on type public.marital_status to authenticated;
