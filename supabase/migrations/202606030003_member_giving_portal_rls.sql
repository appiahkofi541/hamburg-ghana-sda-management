-- Member Giving Portal RLS.
-- Members can read only finance transactions linked to their member profile.
-- Admin and Treasurer can read all giving records.

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

drop policy if exists "Finance viewers can view funds" on public.funds;
create policy "Finance viewers can view funds"
on public.funds for select to authenticated
using (is_active or public.has_any_role(array['admin', 'treasurer']::public.app_role[]));

drop policy if exists "Members can view their online giving" on public.online_giving_payments;
create policy "Members can view their online giving"
on public.online_giving_payments for select to authenticated
using (
  donor_id = auth.uid()
  or public.has_any_role(array['admin', 'treasurer']::public.app_role[])
);

create index if not exists finance_transactions_member_date_idx
on public.finance_transactions (member_id, transaction_date desc);
