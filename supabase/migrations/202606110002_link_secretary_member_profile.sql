-- Link Secretary demo account Grace Appiah to a real member profile.
-- Member-linked features expect public.members.profile_id = auth.users.id.

update public.members
set
  profile_id = 'a0000000-0000-0000-0000-000000000004',
  first_name = 'Grace',
  last_name = 'Appiah',
  full_name = 'Grace Appiah',
  email = 'secretary@hamburgghanasda.demo',
  status = 'active',
  updated_at = now()
where lower(email) = 'secretary@hamburgghanasda.demo'
  and (profile_id is null or profile_id = 'a0000000-0000-0000-0000-000000000004');

insert into public.members (
  id,
  member_number,
  profile_id,
  first_name,
  last_name,
  full_name,
  gender,
  date_of_birth,
  phone,
  email,
  address_line,
  baptism_status,
  baptism_date,
  marital_status,
  occupation,
  status,
  joined_on
)
select
  'b0000000-0000-0000-0000-000000000007',
  'HG-007',
  'a0000000-0000-0000-0000-000000000004',
  'Grace',
  'Appiah',
  'Grace Appiah',
  'female',
  '1987-03-14',
  '+49 176 555 0104',
  'secretary@hamburgghanasda.demo',
  'Hamburg, Germany',
  true,
  '2004-09-18',
  'married',
  'Church Secretary',
  'active',
  '2021-09-01'
where exists (
  select 1
  from public.profiles
  where id = 'a0000000-0000-0000-0000-000000000004'
)
and not exists (
  select 1
  from public.members
  where profile_id = 'a0000000-0000-0000-0000-000000000004'
)
on conflict (member_number) do update set
  profile_id = excluded.profile_id,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  full_name = excluded.full_name,
  gender = excluded.gender,
  date_of_birth = excluded.date_of_birth,
  phone = excluded.phone,
  email = excluded.email,
  address_line = excluded.address_line,
  baptism_status = excluded.baptism_status,
  baptism_date = excluded.baptism_date,
  marital_status = excluded.marital_status,
  occupation = excluded.occupation,
  status = excluded.status,
  joined_on = excluded.joined_on,
  updated_at = now();

insert into public.department_members (department_id, member_id, is_department_head)
select departments.id, members.id, false
from public.departments
join public.members on members.profile_id = 'a0000000-0000-0000-0000-000000000004'
where departments.name = 'Secretariat'
on conflict (department_id, member_id) do update set
  is_department_head = excluded.is_department_head;
