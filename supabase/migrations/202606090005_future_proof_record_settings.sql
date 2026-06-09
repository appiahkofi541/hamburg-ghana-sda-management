-- Future-proof configurable records for Hamburg Ghana SDA Church.
-- Keeps historical records safe by referencing category IDs and using is_active
-- instead of deleting important categories.

create table if not exists public.record_settings (
  id uuid primary key default gen_random_uuid(),
  setting_group text not null,
  name text not null,
  slug text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  constraint record_settings_group_slug_unique unique (setting_group, slug)
);

create index if not exists record_settings_group_active_idx
on public.record_settings (setting_group, is_active, sort_order, name);

drop trigger if exists record_settings_set_updated_at on public.record_settings;
create trigger record_settings_set_updated_at
before update on public.record_settings
for each row execute function public.set_updated_at();

alter table public.departments
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists ministry_group_id uuid references public.record_settings(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table public.finance_categories
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

with duplicate_categories as (
  select id, name, row_number() over (partition by name order by created_at nulls last, id) as duplicate_index
  from public.finance_categories
)
update public.finance_categories
set name = public.finance_categories.name || ' (' || left(public.finance_categories.id::text, 8) || ')'
from duplicate_categories
where public.finance_categories.id = duplicate_categories.id
  and duplicate_categories.duplicate_index > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_categories_name_unique'
      and conrelid = 'public.finance_categories'::regclass
  ) then
    alter table public.finance_categories
      add constraint finance_categories_name_unique unique (name);
  end if;
end $$;

alter table public.events
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists departments_ministry_group_idx
on public.departments (ministry_group_id);

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

drop trigger if exists finance_categories_set_updated_at on public.finance_categories;
create trigger finance_categories_set_updated_at
before update on public.finance_categories
for each row execute function public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.finance_transactions
  alter column payment_method type text using payment_method::text;

create or replace function public.can_manage_record_settings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'church_clerk', 'secretary', 'treasurer']::public.app_role[]);
$$;

insert into public.record_settings (setting_group, name, slug, description, sort_order, is_active)
values
  ('event_category', 'Sabbath Program', 'sabbath-program', 'Sabbath worship, Sabbath School, and fellowship programs.', 10, true),
  ('event_category', 'Camp Meeting', 'camp-meeting', 'Camp meetings, retreats, and conference gatherings.', 20, true),
  ('event_category', 'Evangelism Campaign', 'evangelism-campaign', 'Outreach, Bible campaigns, and public evangelism.', 30, true),
  ('event_category', 'Youth Congress', 'youth-congress', 'Youth and young adult programs.', 40, true),
  ('event_category', 'Other', 'other', 'General church event category.', 999, true),
  ('payment_method', 'Cash', 'cash', 'Physical cash payment.', 10, true),
  ('payment_method', 'Bank Transfer', 'bank-transfer', 'Bank transfer payment.', 20, true),
  ('payment_method', 'Card', 'card', 'Card payment.', 30, true),
  ('payment_method', 'Mobile Money', 'mobile-money', 'Mobile money payment.', 40, true),
  ('payment_method', 'Other', 'other', 'Other payment method.', 999, true),
  ('ministry_group', 'Adult Ministries', 'adult-ministries', 'Adult ministry coordination group.', 10, true),
  ('ministry_group', 'Youth Ministries', 'youth-ministries', 'Youth and young adult ministry group.', 20, true),
  ('ministry_group', 'Children Ministries', 'children-ministries', 'Children and family ministry group.', 30, true),
  ('ministry_group', 'Support Ministries', 'support-ministries', 'Administrative and support ministry group.', 40, true)
on conflict (setting_group, slug) do update
set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.finance_categories (name, type, description, is_active)
values
  ('Tithe', 'income', 'Member tithe contributions.', true),
  ('Sabbath Offering', 'income', 'Sabbath offering contributions.', true),
  ('Building Fund', 'income', 'Building fund contributions.', true),
  ('Thanksgiving', 'income', 'Thanksgiving offering contributions.', true),
  ('Special Donation', 'income', 'Special donation contributions.', true),
  ('Rent', 'expense', 'Rent and facility expense.', true),
  ('Utilities', 'expense', 'Utility bills and services.', true),
  ('Welfare Support', 'expense', 'Welfare support expense.', true),
  ('Evangelism Expenses', 'expense', 'Evangelism and outreach expense.', true),
  ('Department Expenses', 'expense', 'Department ministry expense.', true),
  ('Maintenance', 'expense', 'Maintenance and repair expense.', true)
on conflict (name) do update
set
  type = excluded.type,
  description = excluded.description,
  is_active = true;

alter table public.record_settings enable row level security;

drop policy if exists "Authenticated users can view active record settings" on public.record_settings;
create policy "Authenticated users can view active record settings"
on public.record_settings for select to authenticated
using (is_active or public.can_manage_record_settings());

drop policy if exists "Authorized leaders can manage record settings" on public.record_settings;
create policy "Authorized leaders can manage record settings"
on public.record_settings for all to authenticated
using (public.can_manage_record_settings())
with check (public.can_manage_record_settings());

drop policy if exists "Contribution viewers can view categories" on public.finance_categories;
drop policy if exists "Finance viewers can view categories" on public.finance_categories;
create policy "Contribution viewers can view categories"
on public.finance_categories for select to authenticated
using (is_active or public.can_view_contributions() or public.can_manage_record_settings());

drop policy if exists "Contribution managers can manage categories" on public.finance_categories;
drop policy if exists "Treasurers can manage categories" on public.finance_categories;
drop policy if exists "Finance sub-account managers can manage categories" on public.finance_categories;
create policy "Contribution managers can manage categories"
on public.finance_categories for all to authenticated
using (public.can_manage_contributions() or public.can_manage_record_settings())
with check (public.can_manage_contributions() or public.can_manage_record_settings());

grant select, insert, update on public.record_settings to authenticated;
grant execute on function public.can_manage_record_settings() to authenticated;
