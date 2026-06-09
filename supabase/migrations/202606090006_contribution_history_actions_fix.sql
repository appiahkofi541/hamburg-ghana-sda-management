-- Reinforce Contribution History edit/delete permissions.
-- Treasurer and Super Admin can update and delete contribution records.

create or replace function public.can_manage_contributions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'treasurer']::public.app_role[]);
$$;

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
grant select, insert, update, delete on public.finance_transactions to authenticated;
