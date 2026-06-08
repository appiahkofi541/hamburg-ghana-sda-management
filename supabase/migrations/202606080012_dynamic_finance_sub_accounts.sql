-- Dynamic finance sub-accounts for income and expenditure.
-- Uses finance_categories as the sub-account register so future categories can be
-- added without changing application code.

alter table public.finance_categories
  add column if not exists description text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now();

update public.finance_categories
set name = trim(name)
where name <> trim(name);

with duplicates as (
  select
    id,
    row_number() over (partition by lower(name) order by created_at, id) as duplicate_number
  from public.finance_categories
)
update public.finance_categories
set name = public.finance_categories.name || ' (' || left(public.finance_categories.id::text, 8) || ')'
from duplicates
where public.finance_categories.id = duplicates.id
  and duplicates.duplicate_number > 1;

create unique index if not exists finance_categories_name_lower_unique_idx
on public.finance_categories (lower(name));

create index if not exists finance_categories_type_active_idx
on public.finance_categories (type, is_active);

create index if not exists finance_transactions_category_month_idx
on public.finance_transactions (category_id, transaction_date desc);

create index if not exists finance_transactions_member_method_idx
on public.finance_transactions (member_id, payment_method);

insert into public.finance_categories (name, type, description, is_active) values
  ('Tithe', 'income', 'Member tithe contributions.', true),
  ('Sabbath Offering', 'income', 'Weekly Sabbath offering income.', true),
  ('Thanksgiving', 'income', 'Thanksgiving offerings and gifts.', true),
  ('Building Fund', 'income', 'Building fund contributions.', true),
  ('Welfare Fund', 'income', 'Welfare fund contributions.', true),
  ('Special Donations', 'income', 'Special purpose donations.', true),
  ('Donations', 'income', 'General donations and gifts.', true),
  ('Other Income', 'income', 'Other income not classified elsewhere.', true),
  ('Rent', 'expense', 'Rent and facility lease expenses.', true),
  ('Utilities', 'expense', 'Electricity, water, heating, internet, and related utilities.', true),
  ('Welfare Support', 'expense', 'Member and community welfare support payments.', true),
  ('Evangelism Expenses', 'expense', 'Evangelism campaign and outreach expenses.', true),
  ('Department Expenses', 'expense', 'Department ministry operating expenses.', true),
  ('Transportation', 'expense', 'Transportation and travel expenses.', true),
  ('Maintenance', 'expense', 'Repairs and maintenance expenses.', true),
  ('Equipment', 'expense', 'Equipment purchases and replacements.', true),
  ('Printing & Stationery', 'expense', 'Printing, stationery, and office materials.', true),
  ('Other Expenses', 'expense', 'Other expenditure not classified elsewhere.', true)
on conflict (name) do update
set
  type = excluded.type,
  description = excluded.description,
  is_active = true;

drop policy if exists "Finance viewers can view categories" on public.finance_categories;
drop policy if exists "Treasurers can manage categories" on public.finance_categories;
drop policy if exists "Finance sub-account managers can manage categories" on public.finance_categories;

create policy "Finance viewers can view categories"
on public.finance_categories for select to authenticated
using (
  public.can_view_finance_reports()
  or is_active
);

create policy "Finance sub-account managers can manage categories"
on public.finance_categories for all to authenticated
using (
  public.has_any_role(array['super_admin', 'treasurer']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'treasurer']::public.app_role[])
);
