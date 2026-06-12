-- Public read-only asset lookup for QR code scans.

create or replace function public.get_public_asset_lookup(asset_number_input text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with selected_asset as (
    select
      assets.id,
      assets.asset_number,
      assets.name,
      assets.description,
      assets.serial_number,
      assets.purchase_date,
      assets.current_value,
      assets.location,
      assets.status,
      assets.notes,
      asset_categories.name as category_name
    from public.assets
    left join public.asset_categories on asset_categories.id = assets.category_id
    where assets.asset_number = asset_number_input
    limit 1
  ),
  assignment_rows as (
    select
      asset_assignments.id,
      asset_assignments.assigned_to_type,
      case
        when asset_assignments.assigned_to_type = 'member' then coalesce(members.full_name, trim(coalesce(members.first_name, '') || ' ' || coalesce(members.last_name, '')), members.member_id, 'Member')
        when asset_assignments.assigned_to_type = 'department' then coalesce(departments.name, 'Department')
        when asset_assignments.assigned_to_type = 'church_role' then coalesce(asset_assignments.assigned_role, 'Church Role')
        when asset_assignments.assigned_to_type = 'location' then coalesce(asset_assignments.assigned_location, 'Location')
        when asset_assignments.assigned_to_type = 'pastor' then coalesce(profiles.full_name, profiles.email, 'Pastor')
        else initcap(replace(asset_assignments.assigned_to_type, '_', ' '))
      end as assigned_to_name,
      asset_assignments.assigned_role,
      asset_assignments.assigned_location,
      asset_assignments.checked_out_at,
      asset_assignments.checked_in_at,
      asset_assignments.expected_return_date,
      asset_assignments.condition_out,
      asset_assignments.condition_in,
      asset_assignments.notes
    from public.asset_assignments
    join selected_asset on selected_asset.id = asset_assignments.asset_id
    left join public.members on members.id = asset_assignments.member_id
    left join public.departments on departments.id = asset_assignments.department_id
    left join public.profiles on profiles.id = asset_assignments.profile_id
    order by asset_assignments.checked_out_at desc
  )
  select case
    when not exists (select 1 from selected_asset) then null
    else jsonb_build_object(
      'asset', (
        select to_jsonb(selected_asset)
        from selected_asset
      ),
      'currentAssignment', (
        select to_jsonb(assignment_rows)
        from assignment_rows
        where assignment_rows.checked_in_at is null
        order by assignment_rows.checked_out_at desc
        limit 1
      ),
      'assignmentHistory', coalesce((
        select jsonb_agg(to_jsonb(assignment_rows) order by assignment_rows.checked_out_at desc)
        from assignment_rows
      ), '[]'::jsonb)
    )
  end;
$$;

revoke execute on function public.get_public_asset_lookup(text) from public;
grant execute on function public.get_public_asset_lookup(text) to anon, authenticated;
