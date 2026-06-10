-- Tithe & Offerings module completion for Hamburg Ghana SDA Church.
-- This migration keeps the existing finance ledger and ensures contribution
-- categories, account seeds, member lookup access, and RLS match the app.

create table if not exists public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type public.finance_transaction_type not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  account_type public.finance_account_type not null,
  opening_balance numeric(12, 2) not null default 0,
  current_balance numeric(12, 2) not null default 0,
  description text,
  status public.finance_account_status not null default 'active',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  transaction_type public.finance_transaction_type not null default 'income',
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  transfer_to_account_id uuid references public.finance_accounts(id) on delete restrict,
  category_id uuid references public.finance_categories(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'EUR',
  description text not null,
  payment_method text not null default 'cash',
  notes text,
  reference_number text unique,
  member_id uuid references public.members(id) on delete set null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_categories
  add column if not exists description text,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

alter table public.finance_transactions
  add column if not exists currency text not null default 'EUR',
  add column if not exists notes text,
  add column if not exists reference_number text unique,
  add column if not exists member_id uuid references public.members(id) on delete set null,
  add column if not exists recorded_by uuid references public.profiles(id) on delete set null;

alter table public.finance_transactions
  alter column payment_method type text using payment_method::text;

insert into public.finance_accounts (name, account_type, opening_balance, current_balance, description, status)
values
  ('Cash Account', 'asset', 0, 0, 'Physical cash handled by treasury.', 'active'),
  ('Bank Account', 'asset', 0, 0, 'Primary church bank account.', 'active'),
  ('Tithe Account', 'fund', 0, 0, 'Dedicated tithe account.', 'active'),
  ('Offering Account', 'income', 0, 0, 'General offering account.', 'active'),
  ('Building Fund Account', 'fund', 0, 0, 'Building fund account.', 'active'),
  ('Mission Fund Account', 'fund', 0, 0, 'Mission offering account.', 'active'),
  ('Welfare Fund Account', 'fund', 0, 0, 'Welfare fund account.', 'active'),
  ('Donations Account', 'income', 0, 0, 'Special donation account.', 'active')
on conflict (name) do update
set
  description = excluded.description,
  status = 'active';

insert into public.finance_categories (name, type, description, is_active)
values
  ('Tithe', 'income', 'Member tithe contributions.', true),
  ('Offering', 'income', 'General Sabbath and church offering contributions.', true),
  ('Building Fund', 'income', 'Building fund contributions.', true),
  ('Thanksgiving', 'income', 'Thanksgiving offering contributions.', true),
  ('Mission Offering', 'income', 'Mission offering and evangelism support contributions.', true),
  ('Welfare Fund', 'income', 'Welfare fund contributions.', true),
  ('Special Donation', 'income', 'Special purpose donation contributions.', true)
on conflict (name) do update
set
  type = excluded.type,
  description = excluded.description,
  is_active = true;

create index if not exists finance_transactions_member_date_idx
on public.finance_transactions (member_id, transaction_date desc);

create index if not exists finance_transactions_reference_idx
on public.finance_transactions (reference_number);

create index if not exists finance_transactions_category_date_idx
on public.finance_transactions (category_id, transaction_date desc);

create index if not exists finance_transactions_recorded_by_idx
on public.finance_transactions (recorded_by);

create index if not exists finance_categories_type_active_idx
on public.finance_categories (type, is_active);

alter table public.finance_categories enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.finance_transactions enable row level security;

create or replace function public.can_manage_contributions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'treasurer']::public.app_role[]);
$$;

create or replace function public.can_view_contributions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'elder', 'treasurer']::public.app_role[]);
$$;

create or replace function public.is_own_contribution(transaction_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members
    where members.id = transaction_member_id
      and members.profile_id = auth.uid()
  );
$$;

drop policy if exists "Contribution viewers can view categories" on public.finance_categories;
drop policy if exists "Finance viewers can view categories" on public.finance_categories;
drop policy if exists "Finance sub-account viewers can view categories" on public.finance_categories;
create policy "Contribution viewers can view categories"
on public.finance_categories for select to authenticated
using (is_active or public.can_view_contributions());

drop policy if exists "Contribution managers can manage categories" on public.finance_categories;
drop policy if exists "Treasurers can manage categories" on public.finance_categories;
drop policy if exists "Finance sub-account managers can manage categories" on public.finance_categories;
create policy "Contribution managers can manage categories"
on public.finance_categories for all to authenticated
using (public.can_manage_contributions())
with check (public.can_manage_contributions());

drop policy if exists "Contribution viewers can view accounts" on public.finance_accounts;
drop policy if exists "Finance viewers can view accounts" on public.finance_accounts;
create policy "Contribution viewers can view accounts"
on public.finance_accounts for select to authenticated
using (public.can_view_contributions() or public.can_manage_contributions());

drop policy if exists "Contribution managers can view member lookup" on public.members;
drop policy if exists "Finance users can view active members for payments" on public.members;
create policy "Contribution managers can view member lookup"
on public.members for select to authenticated
using (
  profile_id = auth.uid()
  or public.has_any_role(array['super_admin', 'treasurer']::public.app_role[])
);

drop policy if exists "Contribution viewers and owners can view transactions" on public.finance_transactions;
drop policy if exists "Finance viewers can view transactions" on public.finance_transactions;
drop policy if exists "Finance viewers and members can view transactions" on public.finance_transactions;
create policy "Contribution viewers and owners can view transactions"
on public.finance_transactions for select to authenticated
using (
  public.can_view_contributions()
  or public.is_own_contribution(member_id)
);

drop policy if exists "Contribution managers can insert transactions" on public.finance_transactions;
create policy "Contribution managers can insert transactions"
on public.finance_transactions for insert to authenticated
with check (public.can_manage_contributions());

drop policy if exists "Contribution managers can update transactions" on public.finance_transactions;
create policy "Contribution managers can update transactions"
on public.finance_transactions for update to authenticated
using (public.can_manage_contributions())
with check (public.can_manage_contributions());

drop policy if exists "Contribution managers can delete transactions" on public.finance_transactions;
drop policy if exists "Treasurers can manage transactions" on public.finance_transactions;
create policy "Contribution managers can delete transactions"
on public.finance_transactions for delete to authenticated
using (public.can_manage_contributions());

grant execute on function public.can_manage_contributions() to authenticated;
grant execute on function public.can_view_contributions() to authenticated;
grant execute on function public.is_own_contribution(uuid) to authenticated;

grant select on public.finance_categories, public.finance_accounts to authenticated;
grant select, insert, update, delete on public.finance_transactions to authenticated;
