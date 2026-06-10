-- Ensure Super Admin and Treasurer have identical finance management access.
-- Fixes finance account visibility and management for Super Admin users.

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

alter table public.finance_accounts enable row level security;

drop policy if exists "Contribution viewers can view accounts" on public.finance_accounts;
drop policy if exists "Finance viewers can view accounts" on public.finance_accounts;
drop policy if exists "Finance account viewers can view accounts" on public.finance_accounts;
create policy "Finance account viewers can view accounts"
on public.finance_accounts for select to authenticated
using (
  public.can_view_contributions()
  or public.can_manage_contributions()
);

drop policy if exists "Treasurers can manage accounts" on public.finance_accounts;
drop policy if exists "Finance account managers can manage accounts" on public.finance_accounts;
create policy "Finance account managers can manage accounts"
on public.finance_accounts for all to authenticated
using (public.can_manage_contributions())
with check (public.can_manage_contributions());

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

drop policy if exists "Contribution managers can manage categories" on public.finance_categories;
drop policy if exists "Treasurers can manage categories" on public.finance_categories;
drop policy if exists "Finance sub-account managers can manage categories" on public.finance_categories;
create policy "Contribution managers can manage categories"
on public.finance_categories for all to authenticated
using (public.can_manage_contributions())
with check (public.can_manage_contributions());

grant execute on function public.can_manage_contributions() to authenticated;
grant execute on function public.can_view_contributions() to authenticated;
grant select, insert, update, delete on public.finance_accounts to authenticated;
grant select, insert, update, delete on public.finance_transactions to authenticated;
grant select, insert, update on public.finance_categories to authenticated;
