-- Asset & Inventory Management module for Hamburg Ghana SDA Church.

create table if not exists public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  asset_number text not null unique,
  name text not null,
  category_id uuid references public.asset_categories(id) on delete set null,
  description text,
  serial_number text,
  purchase_date date,
  purchase_cost numeric(12,2) not null default 0 check (purchase_cost >= 0),
  current_value numeric(12,2) not null default 0 check (current_value >= 0),
  location text,
  status text not null default 'available' check (status in ('available', 'in_use', 'under_maintenance', 'retired', 'lost')),
  assigned_member_id uuid references public.members(id) on delete set null,
  assigned_department_id uuid references public.departments(id) on delete set null,
  assigned_profile_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  assigned_to_type text not null check (assigned_to_type in ('member', 'department', 'pastor')),
  member_id uuid references public.members(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  checked_out_at timestamptz not null default now(),
  checked_in_at timestamptz,
  condition_out text,
  condition_in text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_maintenance (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  maintenance_date date not null default current_date,
  maintenance_type text not null default 'scheduled',
  service_provider text,
  maintenance_cost numeric(12,2) not null default 0 check (maintenance_cost >= 0),
  next_maintenance_date date,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_number text not null unique,
  name text not null,
  category text,
  description text,
  quantity integer not null default 0 check (quantity >= 0),
  reorder_level integer not null default 0 check (reorder_level >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  supplier text,
  location text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  purchase_date date not null default current_date,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  supplier text,
  receipt_reference text,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  adjustment_date date not null default current_date,
  quantity_change integer not null,
  reason text not null,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

drop trigger if exists asset_categories_set_updated_at on public.asset_categories;
create trigger asset_categories_set_updated_at before update on public.asset_categories for each row execute function public.set_updated_at();
drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();
drop trigger if exists asset_assignments_set_updated_at on public.asset_assignments;
create trigger asset_assignments_set_updated_at before update on public.asset_assignments for each row execute function public.set_updated_at();
drop trigger if exists asset_maintenance_set_updated_at on public.asset_maintenance;
create trigger asset_maintenance_set_updated_at before update on public.asset_maintenance for each row execute function public.set_updated_at();
drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at before update on public.inventory_items for each row execute function public.set_updated_at();

create index if not exists assets_status_idx on public.assets (status);
create index if not exists assets_category_idx on public.assets (category_id);
create index if not exists assets_assigned_member_idx on public.assets (assigned_member_id);
create index if not exists assets_assigned_department_idx on public.assets (assigned_department_id);
create index if not exists asset_assignments_asset_idx on public.asset_assignments (asset_id, checked_out_at desc);
create index if not exists asset_maintenance_asset_idx on public.asset_maintenance (asset_id, maintenance_date desc);
create index if not exists asset_maintenance_next_idx on public.asset_maintenance (next_maintenance_date);
create index if not exists inventory_items_low_stock_idx on public.inventory_items (quantity, reorder_level);
create index if not exists inventory_purchases_item_idx on public.inventory_purchases (inventory_item_id, purchase_date desc);
create index if not exists inventory_adjustments_item_idx on public.inventory_adjustments (inventory_item_id, adjustment_date desc);

create or replace function public.can_view_assets()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'secretary', 'treasurer', 'pastor']::public.app_role[]);
$$;

create or replace function public.can_manage_assets()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'secretary']::public.app_role[]);
$$;

create or replace function public.can_manage_asset_values()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'secretary', 'treasurer']::public.app_role[]);
$$;

alter table public.asset_categories enable row level security;
alter table public.assets enable row level security;
alter table public.asset_assignments enable row level security;
alter table public.asset_maintenance enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_purchases enable row level security;
alter table public.inventory_adjustments enable row level security;

drop policy if exists "Asset viewers can view categories" on public.asset_categories;
create policy "Asset viewers can view categories" on public.asset_categories for select to authenticated using (public.can_view_assets());
drop policy if exists "Asset managers can manage categories" on public.asset_categories;
create policy "Asset managers can manage categories" on public.asset_categories for all to authenticated using (public.can_manage_assets()) with check (public.can_manage_assets());

drop policy if exists "Asset viewers can view assets" on public.assets;
create policy "Asset viewers can view assets" on public.assets for select to authenticated using (public.can_view_assets());
drop policy if exists "Asset managers can insert assets" on public.assets;
create policy "Asset managers can insert assets" on public.assets for insert to authenticated with check (public.can_manage_asset_values());
drop policy if exists "Asset managers can update assets" on public.assets;
create policy "Asset managers can update assets" on public.assets for update to authenticated using (public.can_manage_asset_values()) with check (public.can_manage_asset_values());
drop policy if exists "Asset managers can delete assets" on public.assets;
create policy "Asset managers can delete assets" on public.assets for delete to authenticated using (public.can_manage_assets());

drop policy if exists "Asset viewers can view assignments" on public.asset_assignments;
create policy "Asset viewers can view assignments" on public.asset_assignments for select to authenticated using (public.can_view_assets());
drop policy if exists "Asset managers can manage assignments" on public.asset_assignments;
create policy "Asset managers can manage assignments" on public.asset_assignments for all to authenticated using (public.can_manage_assets()) with check (public.can_manage_assets());

drop policy if exists "Asset viewers can view maintenance" on public.asset_maintenance;
create policy "Asset viewers can view maintenance" on public.asset_maintenance for select to authenticated using (public.can_view_assets());
drop policy if exists "Asset managers can manage maintenance" on public.asset_maintenance;
create policy "Asset managers can manage maintenance" on public.asset_maintenance for all to authenticated using (public.can_manage_asset_values()) with check (public.can_manage_asset_values());

drop policy if exists "Asset viewers can view inventory" on public.inventory_items;
create policy "Asset viewers can view inventory" on public.inventory_items for select to authenticated using (public.can_view_assets());
drop policy if exists "Asset managers can manage inventory" on public.inventory_items;
create policy "Asset managers can manage inventory" on public.inventory_items for all to authenticated using (public.can_manage_asset_values()) with check (public.can_manage_asset_values());

drop policy if exists "Asset viewers can view inventory purchases" on public.inventory_purchases;
create policy "Asset viewers can view inventory purchases" on public.inventory_purchases for select to authenticated using (public.can_view_assets());
drop policy if exists "Asset managers can manage inventory purchases" on public.inventory_purchases;
create policy "Asset managers can manage inventory purchases" on public.inventory_purchases for all to authenticated using (public.can_manage_asset_values()) with check (public.can_manage_asset_values());

drop policy if exists "Asset viewers can view inventory adjustments" on public.inventory_adjustments;
create policy "Asset viewers can view inventory adjustments" on public.inventory_adjustments for select to authenticated using (public.can_view_assets());
drop policy if exists "Asset managers can manage inventory adjustments" on public.inventory_adjustments;
create policy "Asset managers can manage inventory adjustments" on public.inventory_adjustments for all to authenticated using (public.can_manage_asset_values()) with check (public.can_manage_asset_values());

grant select, insert, update, delete on public.asset_categories, public.assets, public.asset_assignments, public.asset_maintenance, public.inventory_items, public.inventory_purchases, public.inventory_adjustments to authenticated;
grant execute on function public.can_view_assets() to authenticated;
grant execute on function public.can_manage_assets() to authenticated;
grant execute on function public.can_manage_asset_values() to authenticated;

insert into public.asset_categories (name, description)
values
  ('Musical Instruments', 'Keyboards, drums, guitars, and other worship instruments.'),
  ('Audio Equipment', 'Mixers, speakers, microphones, and sound accessories.'),
  ('Video Equipment', 'Cameras, projectors, livestream, and display equipment.'),
  ('Computers', 'Laptops, desktops, tablets, and office technology.'),
  ('Furniture', 'Chairs, tables, cabinets, and office furniture.'),
  ('Vehicles', 'Church-owned vehicles and transport equipment.'),
  ('Building Equipment', 'Facilities, maintenance, and building operations equipment.'),
  ('Other', 'Uncategorized church assets.')
on conflict (name) do update set description = excluded.description, is_active = true, updated_at = now();

insert into public.assets (asset_number, name, category_id, description, serial_number, purchase_date, purchase_cost, current_value, location, status, notes)
select 'AST-2026-001', 'Main Sanctuary Keyboard', asset_categories.id, 'Primary worship keyboard used for Sabbath services.', 'HG-KBD-001', current_date - interval '180 days', 1200, 980, 'Sanctuary', 'in_use', 'Demo asset for testing.'
from public.asset_categories
where asset_categories.name = 'Musical Instruments'
on conflict (asset_number) do nothing;

insert into public.inventory_items (item_number, name, category, description, quantity, reorder_level, unit_cost, supplier, location)
values
  ('INV-2026-001', 'AA Batteries', 'Audio Equipment', 'Batteries for wireless microphones.', 8, 12, 1.50, 'Local electronics supplier', 'Media room'),
  ('INV-2026-002', 'Communion Cups', 'Church Supplies', 'Disposable communion cups.', 250, 100, 0.05, 'Church supplies vendor', 'Storage room')
on conflict (item_number) do nothing;
