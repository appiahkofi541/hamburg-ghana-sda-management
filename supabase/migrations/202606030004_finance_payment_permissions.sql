-- Finance payment permissions and member contribution visibility.
-- Treasurer manages payments. Admin can view/export/report only. Members see
-- only their own contribution history through the member portal.

do $$ begin
  alter type public.finance_transaction_type add value if not exists 'building_fund';
  alter type public.finance_transaction_type add value if not exists 'mission_offering';
  alter type public.finance_transaction_type add value if not exists 'other';
exception when undefined_object then null;
end $$;

drop policy if exists "Finance viewers can view transactions" on public.finance_transactions;
create policy "Finance viewers can view transactions"
on public.finance_transactions for select to authenticated
using (
  public.has_any_role(array['admin', 'treasurer']::public.app_role[])
  or exists (
    select 1
    from public.members
    where members.id = finance_transactions.member_id
      and members.profile_id = auth.uid()
  )
);

drop policy if exists "Treasurers can manage transactions" on public.finance_transactions;
create policy "Treasurers can manage transactions"
on public.finance_transactions for all to authenticated
using (public.has_role('treasurer'))
with check (public.has_role('treasurer'));

drop policy if exists "Finance viewers can view accounts" on public.finance_accounts;
create policy "Finance viewers can view accounts"
on public.finance_accounts for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));

drop policy if exists "Treasurers can manage accounts" on public.finance_accounts;
create policy "Treasurers can manage accounts"
on public.finance_accounts for all to authenticated
using (public.has_role('treasurer'))
with check (public.has_role('treasurer'));

drop policy if exists "Finance viewers can view categories" on public.finance_categories;
create policy "Finance viewers can view categories"
on public.finance_categories for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));

drop policy if exists "Treasurers can manage categories" on public.finance_categories;
create policy "Treasurers can manage categories"
on public.finance_categories for all to authenticated
using (public.has_role('treasurer'))
with check (public.has_role('treasurer'));

drop policy if exists "Members can view their online giving" on public.online_giving_payments;
create policy "Members can view their online giving"
on public.online_giving_payments for select to authenticated
using (
  donor_id = auth.uid()
  or public.has_any_role(array['admin', 'treasurer']::public.app_role[])
);

create or replace function public.finance_apply_transaction_balance_insert(row_value public.finance_transactions)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if row_value.transaction_type::text in ('income', 'tithe', 'offering', 'building_fund', 'mission_offering', 'donation', 'welfare', 'other', 'other_church_payment') then
    update public.finance_accounts set current_balance = current_balance + row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type::text in ('expenditure', 'expense') then
    update public.finance_accounts set current_balance = current_balance - row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type::text = 'transfer' then
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
  if row_value.transaction_type::text in ('income', 'tithe', 'offering', 'building_fund', 'mission_offering', 'donation', 'welfare', 'other', 'other_church_payment') then
    update public.finance_accounts set current_balance = current_balance - row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type::text in ('expenditure', 'expense') then
    update public.finance_accounts set current_balance = current_balance + row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type::text = 'transfer' then
    update public.finance_accounts set current_balance = current_balance + row_value.amount where id = row_value.account_id;
    update public.finance_accounts set current_balance = current_balance - row_value.amount where id = row_value.transfer_to_account_id;
  end if;
end;
$$;
