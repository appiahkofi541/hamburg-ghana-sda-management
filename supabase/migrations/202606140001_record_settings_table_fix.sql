-- Focused repair for Settings > Configurable Records.
-- Creates public.record_settings without depending on broader future-proof migrations.

create extension if not exists pgcrypto;

create table if not exists public.record_settings (
  id uuid primary key default gen_random_uuid(),
  setting_group text not null,
  group_key text,
  name text not null,
  slug text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.record_settings
  add column if not exists setting_group text,
  add column if not exists group_key text,
  add column if not exists name text,
  add column if not exists slug text,
  add column if not exists description text,
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 100,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.record_settings
set
  setting_group = coalesce(nullif(setting_group, ''), nullif(group_key, ''), 'event_category'),
  group_key = coalesce(nullif(group_key, ''), nullif(setting_group, ''), 'event_category'),
  slug = coalesce(nullif(slug, ''), lower(regexp_replace(coalesce(name, id::text), '[^a-zA-Z0-9]+', '-', 'g'))),
  name = coalesce(nullif(name, ''), 'Unnamed Record');

alter table public.record_settings
  alter column setting_group set not null,
  alter column group_key set not null,
  alter column name set not null,
  alter column slug set not null,
  alter column is_active set default true,
  alter column sort_order set default 100,
  alter column created_at set default now(),
  alter column updated_at set default now();

create unique index if not exists record_settings_group_slug_unique_idx
on public.record_settings (setting_group, slug);

create index if not exists record_settings_group_active_idx
on public.record_settings (setting_group, is_active, sort_order, name);

create index if not exists record_settings_group_key_active_idx
on public.record_settings (group_key, is_active, sort_order, name);

create or replace function public.record_settings_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.setting_group := coalesce(nullif(new.setting_group, ''), nullif(new.group_key, ''), 'event_category');
  new.group_key := coalesce(nullif(new.group_key, ''), new.setting_group);
  new.slug := coalesce(nullif(new.slug, ''), lower(regexp_replace(coalesce(new.name, gen_random_uuid()::text), '[^a-zA-Z0-9]+', '-', 'g')));
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists record_settings_before_write on public.record_settings;
create trigger record_settings_before_write
before insert or update on public.record_settings
for each row
execute function public.record_settings_before_write();

create or replace function public.can_manage_record_settings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin']::public.app_role[]);
$$;

create or replace function public.can_view_record_settings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'pastor', 'secretary', 'treasurer']::public.app_role[]);
$$;

insert into public.record_settings (setting_group, group_key, name, slug, description, sort_order, is_active)
values
  ('event_category', 'event_category', 'Sabbath Program', 'sabbath-program', 'Sabbath worship, Sabbath School, and fellowship programs.', 10, true),
  ('event_category', 'event_category', 'Divine Service', 'divine-service', 'Main Sabbath worship service.', 20, true),
  ('event_category', 'event_category', 'Prayer Meeting', 'prayer-meeting', 'Midweek prayer meeting and devotional programs.', 30, true),
  ('event_category', 'event_category', 'Evangelism Campaign', 'evangelism-campaign', 'Outreach, Bible campaigns, and public evangelism.', 40, true),
  ('event_category', 'event_category', 'Youth Program', 'youth-program', 'Youth and young adult programs.', 50, true),
  ('event_category', 'event_category', 'Camp Meeting', 'camp-meeting', 'Camp meetings, retreats, and conference gatherings.', 60, true),
  ('event_category', 'event_category', 'Other', 'other', 'General church event category.', 999, true),
  ('payment_method', 'payment_method', 'Cash', 'cash', 'Physical cash payment.', 10, true),
  ('payment_method', 'payment_method', 'Bank Transfer', 'bank-transfer', 'Bank transfer payment.', 20, true),
  ('payment_method', 'payment_method', 'Card', 'card', 'Card payment.', 30, true),
  ('payment_method', 'payment_method', 'Mobile Money', 'mobile-money', 'Mobile money payment.', 40, true),
  ('payment_method', 'payment_method', 'Cheque', 'cheque', 'Cheque payment.', 50, true),
  ('payment_method', 'payment_method', 'Other', 'other', 'Other payment method.', 999, true),
  ('ministry_group', 'ministry_group', 'Adult Ministries', 'adult-ministries', 'Adult ministry coordination group.', 10, true),
  ('ministry_group', 'ministry_group', 'Youth Ministries', 'youth-ministries', 'Youth and young adult ministry group.', 20, true),
  ('ministry_group', 'ministry_group', 'Children Ministries', 'children-ministries', 'Children and family ministry group.', 30, true),
  ('ministry_group', 'ministry_group', 'Outreach Ministries', 'outreach-ministries', 'Evangelism, mission, and community outreach group.', 40, true),
  ('ministry_group', 'ministry_group', 'Support Ministries', 'support-ministries', 'Administrative and support ministry group.', 50, true),
  ('ministry_group', 'ministry_group', 'Other', 'other', 'General ministry group.', 999, true)
on conflict (setting_group, slug) do update
set
  group_key = excluded.group_key,
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

alter table public.record_settings enable row level security;

drop policy if exists "Active record settings are viewable by leaders" on public.record_settings;
create policy "Active record settings are viewable by leaders"
on public.record_settings for select to authenticated
using (
  (is_active and public.can_view_record_settings())
  or public.can_manage_record_settings()
);

drop policy if exists "Super admins can insert record settings" on public.record_settings;
create policy "Super admins can insert record settings"
on public.record_settings for insert to authenticated
with check (public.can_manage_record_settings());

drop policy if exists "Super admins can update record settings" on public.record_settings;
create policy "Super admins can update record settings"
on public.record_settings for update to authenticated
using (public.can_manage_record_settings())
with check (public.can_manage_record_settings());

drop policy if exists "Super admins can delete record settings" on public.record_settings;
create policy "Super admins can delete record settings"
on public.record_settings for delete to authenticated
using (public.can_manage_record_settings());

grant select, insert, update, delete on public.record_settings to authenticated;
grant execute on function public.can_manage_record_settings() to authenticated;
grant execute on function public.can_view_record_settings() to authenticated;
