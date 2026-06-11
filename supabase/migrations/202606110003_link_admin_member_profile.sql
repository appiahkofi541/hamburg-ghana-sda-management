-- Link the production Admin account to a real member profile.
-- Member-linked features expect public.members.profile_id = auth.users.id.
-- This targets the live admin login: admin@hamburgghanasda.de.

do $$
declare
  admin_profile_id uuid;
  linked_member_id uuid;
begin
  select profiles.id
  into admin_profile_id
  from public.profiles
  where lower(profiles.email) = 'admin@hamburgghanasda.de'
  limit 1;

  if admin_profile_id is null then
    raise notice 'Admin profile admin@hamburgghanasda.de was not found in public.profiles. No member row was linked.';
    return;
  end if;

  select members.id
  into linked_member_id
  from public.members
  where members.profile_id = admin_profile_id
  limit 1;

  if linked_member_id is not null then
    update public.members
    set
      email = 'admin@hamburgghanasda.de',
      status = 'active',
      updated_at = now()
    where id = linked_member_id;
    return;
  end if;

  select members.id
  into linked_member_id
  from public.members
  where lower(members.email) = 'admin@hamburgghanasda.de'
    and members.profile_id is null
  limit 1;

  if linked_member_id is not null then
    update public.members
    set
      profile_id = admin_profile_id,
      email = 'admin@hamburgghanasda.de',
      status = 'active',
      updated_at = now()
    where id = linked_member_id;
    return;
  end if;

  insert into public.members (
    id,
    member_number,
    profile_id,
    first_name,
    last_name,
    full_name,
    gender,
    phone,
    email,
    address_line,
    baptism_status,
    marital_status,
    occupation,
    status,
    joined_on
  )
  values (
    gen_random_uuid(),
    'HG-ADMIN',
    admin_profile_id,
    'Admin',
    'User',
    'Admin User',
    'prefer_not_to_say',
    null,
    'admin@hamburgghanasda.de',
    'Hamburg, Germany',
    false,
    'other',
    'Church Administrator',
    'active',
    current_date
  )
  on conflict (member_number) do update set
    profile_id = admin_profile_id,
    email = excluded.email,
    status = 'active',
    updated_at = now();
end $$;

insert into public.department_members (department_id, member_id, is_department_head)
select departments.id, members.id, false
from public.departments
join public.members on members.profile_id = (
  select profiles.id
  from public.profiles
  where lower(profiles.email) = 'admin@hamburgghanasda.de'
  limit 1
)
where departments.name = 'Secretariat'
on conflict (department_id, member_id) do update set
  is_department_head = excluded.is_department_head;
