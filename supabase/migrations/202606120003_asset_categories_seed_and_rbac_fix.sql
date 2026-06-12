-- Ensure default asset categories are present and visible to legacy admin users.

create or replace function public.can_view_assets()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'secretary', 'treasurer', 'pastor']::public.app_role[]);
$$;

create or replace function public.can_manage_assets()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'secretary']::public.app_role[]);
$$;

create or replace function public.can_manage_asset_values()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'secretary', 'treasurer']::public.app_role[]);
$$;

insert into public.asset_categories (name, description, is_active)
values
  ('Musical Instruments', 'Keyboards, drums, guitars, and other worship instruments.', true),
  ('Audio Equipment', 'Mixers, speakers, microphones, and sound accessories.', true),
  ('Video Equipment', 'Cameras, projectors, livestream, and display equipment.', true),
  ('Computers', 'Laptops, desktops, tablets, and office technology.', true),
  ('Furniture', 'Chairs, tables, cabinets, and office furniture.', true),
  ('Vehicles', 'Church-owned vehicles and transport equipment.', true),
  ('Building Equipment', 'Facilities, maintenance, and building operations equipment.', true),
  ('Other', 'Uncategorized church assets.', true)
on conflict (name) do update
set description = excluded.description,
    is_active = true,
    updated_at = now();

grant execute on function public.can_view_assets() to authenticated;
grant execute on function public.can_manage_assets() to authenticated;
grant execute on function public.can_manage_asset_values() to authenticated;
