-- Priority 3: Church Finance Module for Hamburg Ghana SDA Church.
-- Run after the core finance migrations and the real RBAC migrations.

do $$
begin
  if (
    select count(distinct enum_values.enumlabel)
    from pg_enum enum_values
    join pg_type enum_types on enum_types.oid = enum_values.enumtypid
    join pg_namespace enum_schema on enum_schema.oid = enum_types.typnamespace
    where enum_schema.nspname = 'public'
      and enum_types.typname = 'finance_transaction_type'
      and enum_values.enumlabel in ('building_fund', 'welfare', 'other')
  ) < 3 then
    raise exception 'Missing finance_transaction_type enum values. Run earlier finance migrations 202606030002 and 202606030004 before this migration.';
  end if;
end $$;

alter table public.finance_transactions
  add column if not exists currency text not null default 'EUR';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'finance_transactions_currency_check'
      and conrelid = 'public.finance_transactions'::regclass
  ) then
    alter table public.finance_transactions
      add constraint finance_transactions_currency_check check (currency ~ '^[A-Z]{3}$') not valid;
  end if;
end $$;

alter table public.finance_transactions
  validate constraint finance_transactions_currency_check;

create index if not exists finance_transactions_category_date_idx
on public.finance_transactions (category_id, transaction_date desc);

create index if not exists finance_transactions_recorded_by_idx
on public.finance_transactions (recorded_by);

insert into public.finance_categories (name, type, description, is_active) values
  ('Tithe', 'tithe', 'Tithe contributions from members'),
  ('Offering', 'offering', 'General church offerings'),
  ('Thanksgiving', 'donation', 'Thanksgiving contributions and gifts'),
  ('Building Fund', 'building_fund', 'Building and property fund contributions'),
  ('Welfare Fund', 'welfare', 'Welfare and benevolence fund contributions'),
  ('Special Donations', 'donation', 'Special purpose donations'),
  ('Other', 'other', 'Other church contributions')
on conflict (name) do update
set
  type = excluded.type,
  description = excluded.description,
  is_active = true;

create or replace function public.can_view_finance_reports()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'elder', 'treasurer']::public.app_role[]);
$$;

create or replace function public.can_manage_finance_records()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('treasurer');
$$;

create or replace function public.is_own_finance_transaction(transaction_member_id uuid)
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

drop policy if exists "Finance viewers can view categories" on public.finance_categories;
drop policy if exists "Treasurers can manage categories" on public.finance_categories;
create policy "Finance viewers can view categories"
on public.finance_categories for select to authenticated
using (public.can_view_finance_reports() or is_active);
create policy "Treasurers can manage categories"
on public.finance_categories for all to authenticated
using (public.can_manage_finance_records())
with check (public.can_manage_finance_records());

drop policy if exists "Finance viewers can view accounts" on public.finance_accounts;
drop policy if exists "Treasurers can manage accounts" on public.finance_accounts;
create policy "Finance viewers can view accounts"
on public.finance_accounts for select to authenticated
using (public.can_view_finance_reports());
create policy "Treasurers can manage accounts"
on public.finance_accounts for all to authenticated
using (public.can_manage_finance_records())
with check (public.can_manage_finance_records());

drop policy if exists "Finance viewers can view bank accounts" on public.bank_accounts;
drop policy if exists "Treasurers can manage bank accounts" on public.bank_accounts;
create policy "Finance viewers can view bank accounts"
on public.bank_accounts for select to authenticated
using (public.can_view_finance_reports());
create policy "Treasurers can manage bank accounts"
on public.bank_accounts for all to authenticated
using (public.can_manage_finance_records())
with check (public.can_manage_finance_records());

drop policy if exists "Finance viewers can view cash accounts" on public.cash_accounts;
drop policy if exists "Treasurers can manage cash accounts" on public.cash_accounts;
create policy "Finance viewers can view cash accounts"
on public.cash_accounts for select to authenticated
using (public.can_view_finance_reports());
create policy "Treasurers can manage cash accounts"
on public.cash_accounts for all to authenticated
using (public.can_manage_finance_records())
with check (public.can_manage_finance_records());

drop policy if exists "Finance viewers can view transactions" on public.finance_transactions;
drop policy if exists "Finance viewers and members can view transactions" on public.finance_transactions;
drop policy if exists "Treasurers can manage transactions" on public.finance_transactions;
create policy "Finance viewers and members can view transactions"
on public.finance_transactions for select to authenticated
using (
  public.can_view_finance_reports()
  or public.is_own_finance_transaction(member_id)
);
create policy "Treasurers can manage transactions"
on public.finance_transactions for all to authenticated
using (public.can_manage_finance_records())
with check (public.can_manage_finance_records());

drop policy if exists "Finance viewers can view generated reports" on public.income_expenditure_reports;
drop policy if exists "Treasurers can manage generated reports" on public.income_expenditure_reports;
create policy "Finance viewers can view generated reports"
on public.income_expenditure_reports for select to authenticated
using (public.can_view_finance_reports());
create policy "Treasurers can manage generated reports"
on public.income_expenditure_reports for all to authenticated
using (public.can_manage_finance_records())
with check (public.can_manage_finance_records());

drop policy if exists "Finance viewers can view WhatsApp payment logs" on public.whatsapp_payment_notification_logs;
drop policy if exists "Treasurers can manage WhatsApp payment logs" on public.whatsapp_payment_notification_logs;
create policy "Finance viewers can view WhatsApp payment logs"
on public.whatsapp_payment_notification_logs for select to authenticated
using (public.has_any_role(array['super_admin', 'treasurer']::public.app_role[]));
create policy "Treasurers can manage WhatsApp payment logs"
on public.whatsapp_payment_notification_logs for all to authenticated
using (public.can_manage_finance_records())
with check (public.can_manage_finance_records());

grant execute on function public.can_view_finance_reports() to authenticated;
grant execute on function public.can_manage_finance_records() to authenticated;
grant execute on function public.is_own_finance_transaction(uuid) to authenticated;

grant select, insert, update, delete on
  public.finance_categories,
  public.finance_accounts,
  public.bank_accounts,
  public.cash_accounts,
  public.finance_transactions,
  public.income_expenditure_reports
to authenticated;
