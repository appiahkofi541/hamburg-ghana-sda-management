-- Public read-only member verification for QR code scans.

create or replace function public.get_public_member_lookup(member_number_input text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'member', jsonb_build_object(
      'member_number', members.member_number,
      'full_name', members.full_name,
      'status', members.status,
      'department', coalesce(departments.name, 'Not assigned')
    ),
    'church', jsonb_build_object(
      'church_name', coalesce(church_settings.church_name, 'Hamburg Ghana SDA Church'),
      'short_name', coalesce(church_settings.short_name, 'Hamburg Ghana SDA')
    )
  )
  from public.members
  left join public.department_members
    on department_members.member_id = members.id
  left join public.departments
    on departments.id = department_members.department_id
  left join public.church_settings
    on church_settings.id = true
  where members.member_number = member_number_input
  order by department_members.joined_on desc
  limit 1;
$$;

grant execute on function public.get_public_member_lookup(text) to anon, authenticated;
