-- Full church accounting module for Hamburg Ghana SDA Church.
do $$ begin
  create type public.finance_account_type as enum ('income', 'expense', 'asset', 'liability', 'fund');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.finance_transaction_type as enum ('income', 'expenditure', 'transfer', 'tithe', 'offering', 'donation', 'expense');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.finance_account_status as enum ('active', 'inactive');
exception when duplicate_object then null;
end $$;

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

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  finance_account_id uuid not null unique references public.finance_accounts(id) on delete cascade,
  bank_name text,
  iban_last4 text,
  account_holder text default 'Hamburg Ghana SDA Church',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  finance_account_id uuid not null unique references public.finance_accounts(id) on delete cascade,
  custodian_name text,
  location text default 'Church Treasury',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default current_date,
  transaction_type public.finance_transaction_type not null,
  account_id uuid not null references public.finance_accounts(id) on delete restrict,
  transfer_to_account_id uuid references public.finance_accounts(id) on delete restrict,
  category_id uuid references public.finance_categories(id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null,
  reference_number text unique,
  member_id uuid references public.members(id) on delete set null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (transaction_type = 'transfer' and transfer_to_account_id is not null and transfer_to_account_id <> account_id)
    or (transaction_type <> 'transfer' and transfer_to_account_id is null)
  )
);

create table if not exists public.income_expenditure_reports (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  total_income numeric(12, 2) not null default 0,
  total_expenditure numeric(12, 2) not null default 0,
  net_balance numeric(12, 2) not null default 0,
  generated_by uuid references public.profiles(id) on delete set null,
  generated_at timestamptz not null default now(),
  notes text
);

create or replace function public.finance_apply_transaction_balance()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.transaction_type in ('income', 'tithe', 'offering', 'donation') then
      update public.finance_accounts set current_balance = current_balance + new.amount where id = new.account_id;
    elsif new.transaction_type in ('expenditure', 'expense') then
      update public.finance_accounts set current_balance = current_balance - new.amount where id = new.account_id;
    elsif new.transaction_type = 'transfer' then
      update public.finance_accounts set current_balance = current_balance - new.amount where id = new.account_id;
      update public.finance_accounts set current_balance = current_balance + new.amount where id = new.transfer_to_account_id;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.transaction_type in ('income', 'tithe', 'offering', 'donation') then
      update public.finance_accounts set current_balance = current_balance - old.amount where id = old.account_id;
    elsif old.transaction_type in ('expenditure', 'expense') then
      update public.finance_accounts set current_balance = current_balance + old.amount where id = old.account_id;
    elsif old.transaction_type = 'transfer' then
      update public.finance_accounts set current_balance = current_balance + old.amount where id = old.account_id;
      update public.finance_accounts set current_balance = current_balance - old.amount where id = old.transfer_to_account_id;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    perform public.finance_apply_transaction_balance_delete(old);
    perform public.finance_apply_transaction_balance_insert(new);
    return new;
  end if;

  return null;
end;
$$;

create or replace function public.finance_apply_transaction_balance_insert(row_value public.finance_transactions)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if row_value.transaction_type in ('income', 'tithe', 'offering', 'donation') then
    update public.finance_accounts set current_balance = current_balance + row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type in ('expenditure', 'expense') then
    update public.finance_accounts set current_balance = current_balance - row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type = 'transfer' then
    update public.finance_accounts set current_balance = current_balance - row_value.amount where id = row_value.account_id;
    update public.finance_accounts set current_balance = current_balance + row_value.amount where id = row_value.transfer_to_account_id;
  end if;
end;
$$;

create or replace function public.finance_apply_transaction_balance_delete(row_value public.finance_transactions)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if row_value.transaction_type in ('income', 'tithe', 'offering', 'donation') then
    update public.finance_accounts set current_balance = current_balance - row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type in ('expenditure', 'expense') then
    update public.finance_accounts set current_balance = current_balance + row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type = 'transfer' then
    update public.finance_accounts set current_balance = current_balance + row_value.amount where id = row_value.account_id;
    update public.finance_accounts set current_balance = current_balance - row_value.amount where id = row_value.transfer_to_account_id;
  end if;
end;
$$;

drop trigger if exists finance_transactions_apply_balance on public.finance_transactions;
create trigger finance_transactions_apply_balance
after insert or update or delete on public.finance_transactions
for each row execute function public.finance_apply_transaction_balance();

drop trigger if exists set_finance_accounts_updated_at on public.finance_accounts;
create trigger set_finance_accounts_updated_at before update on public.finance_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_finance_transactions_updated_at on public.finance_transactions;
create trigger set_finance_transactions_updated_at before update on public.finance_transactions
for each row execute function public.set_updated_at();

alter table public.finance_categories enable row level security;
alter table public.finance_accounts enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.cash_accounts enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.income_expenditure_reports enable row level security;

drop policy if exists "Finance viewers can view categories" on public.finance_categories;
create policy "Finance viewers can view categories" on public.finance_categories for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
drop policy if exists "Treasurers can manage categories" on public.finance_categories;
create policy "Treasurers can manage categories" on public.finance_categories for all to authenticated
using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

drop policy if exists "Finance viewers can view accounts" on public.finance_accounts;
create policy "Finance viewers can view accounts" on public.finance_accounts for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
drop policy if exists "Treasurers can manage accounts" on public.finance_accounts;
create policy "Treasurers can manage accounts" on public.finance_accounts for all to authenticated
using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

drop policy if exists "Finance viewers can view bank accounts" on public.bank_accounts;
create policy "Finance viewers can view bank accounts" on public.bank_accounts for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
drop policy if exists "Treasurers can manage bank accounts" on public.bank_accounts;
create policy "Treasurers can manage bank accounts" on public.bank_accounts for all to authenticated
using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

drop policy if exists "Finance viewers can view cash accounts" on public.cash_accounts;
create policy "Finance viewers can view cash accounts" on public.cash_accounts for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
drop policy if exists "Treasurers can manage cash accounts" on public.cash_accounts;
create policy "Treasurers can manage cash accounts" on public.cash_accounts for all to authenticated
using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

drop policy if exists "Finance viewers can view transactions" on public.finance_transactions;
create policy "Finance viewers can view transactions" on public.finance_transactions for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
drop policy if exists "Treasurers can manage transactions" on public.finance_transactions;
create policy "Treasurers can manage transactions" on public.finance_transactions for all to authenticated
using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

drop policy if exists "Finance viewers can view generated reports" on public.income_expenditure_reports;
create policy "Finance viewers can view generated reports" on public.income_expenditure_reports for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
drop policy if exists "Treasurers can manage generated reports" on public.income_expenditure_reports;
create policy "Treasurers can manage generated reports" on public.income_expenditure_reports for all to authenticated
using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

drop policy if exists "Authenticated users can view active funds" on public.funds;
drop policy if exists "Treasury can manage funds" on public.funds;
drop policy if exists "Finance viewers can view funds" on public.funds;
drop policy if exists "Treasurers can manage funds" on public.funds;
create policy "Finance viewers can view funds" on public.funds for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
create policy "Treasurers can manage funds" on public.funds for all to authenticated
using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

drop policy if exists "Treasury can view contribution batches" on public.contribution_batches;
drop policy if exists "Treasury can manage contribution batches" on public.contribution_batches;
drop policy if exists "Finance viewers can view contribution batches" on public.contribution_batches;
drop policy if exists "Treasurers can manage contribution batches" on public.contribution_batches;
create policy "Finance viewers can view contribution batches" on public.contribution_batches for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
create policy "Treasurers can manage contribution batches" on public.contribution_batches for all to authenticated
using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

drop policy if exists "Treasury can view contributions" on public.contributions;
drop policy if exists "Treasury can manage contributions" on public.contributions;
drop policy if exists "Finance viewers can view contributions" on public.contributions;
drop policy if exists "Treasurers can manage contributions" on public.contributions;
create policy "Finance viewers can view contributions" on public.contributions for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));
create policy "Treasurers can manage contributions" on public.contributions for all to authenticated
using (public.has_role('treasurer')) with check (public.has_role('treasurer'));

grant select, insert, update, delete on
  public.finance_categories,
  public.finance_accounts,
  public.bank_accounts,
  public.cash_accounts,
  public.finance_transactions,
  public.income_expenditure_reports
to authenticated;

insert into public.finance_categories (name, type, description) values
  ('General Income', 'income', 'General church income'),
  ('Tithe', 'tithe', 'Tithe receipts'),
  ('Sabbath Offering', 'offering', 'Weekly Sabbath offerings'),
  ('Building Fund', 'donation', 'Building and property support'),
  ('Mission Fund', 'donation', 'Mission and evangelism support'),
  ('Special Donations', 'donation', 'Special purpose donations'),
  ('Welfare Support', 'expense', 'Member welfare and community support'),
  ('Operating Expenses', 'expense', 'General church expenses')
on conflict (name) do update set type = excluded.type, description = excluded.description;

insert into public.finance_accounts (name, account_type, opening_balance, current_balance, description, status) values
  ('Income and Expenditure Account', 'income', 0, 0, 'Summary account for income and expenditure reporting', 'active'),
  ('Cash Account', 'asset', 0, 0, 'Physical cash handled by the treasury team', 'active'),
  ('Bank Account', 'asset', 0, 0, 'Primary Hamburg Ghana SDA Church bank account', 'active'),
  ('Tithe Account', 'fund', 0, 0, 'Dedicated tithe account', 'active'),
  ('Offering Account', 'income', 0, 0, 'General Sabbath offerings account', 'active'),
  ('Building Fund Account', 'fund', 0, 0, 'Building fund account', 'active'),
  ('Mission Fund Account', 'fund', 0, 0, 'Mission and evangelism account', 'active'),
  ('Donations Account', 'income', 0, 0, 'Special donations account', 'active'),
  ('Welfare Account', 'fund', 0, 0, 'Welfare and benevolence account', 'active'),
  ('Expenses Account', 'expense', 0, 0, 'General expenditure account', 'active')
on conflict (name) do nothing;

insert into public.cash_accounts (finance_account_id, custodian_name, location)
select id, 'Church Treasurer', 'Hamburg Ghana SDA Church Treasury'
from public.finance_accounts where name = 'Cash Account'
on conflict (finance_account_id) do nothing;

insert into public.bank_accounts (finance_account_id, bank_name, account_holder)
select id, 'Church Bank', 'Hamburg Ghana SDA Church'
from public.finance_accounts where name = 'Bank Account'
on conflict (finance_account_id) do nothing;

create index if not exists finance_transactions_date_idx on public.finance_transactions (transaction_date desc);
create index if not exists finance_transactions_account_idx on public.finance_transactions (account_id);
create index if not exists finance_accounts_type_idx on public.finance_accounts (account_type);
