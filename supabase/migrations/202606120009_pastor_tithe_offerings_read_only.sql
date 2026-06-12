-- Pastor read-only access for Tithe & Offerings.
-- Pastors can view contribution dashboards, history, statements, payments, and reports.
-- Only Super Admin and Treasurer can create, update, delete, record payments, or manage finance setup.
-- Optional finance tables are checked before policies or grants are applied.

create or replace function public.can_view_contributions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'elder', 'treasurer']::public.app_role[]);
$$;

create or replace function public.can_view_finance_reports()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_view_contributions();
$$;

create or replace function public.can_manage_contributions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'treasurer']::public.app_role[]);
$$;

create or replace function public.can_manage_finance_records()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_contributions();
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

do $$
begin
  if to_regclass('public.finance_categories') is not null then
    alter table public.finance_categories enable row level security;

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

    grant select on public.finance_categories to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.finance_accounts') is not null then
    alter table public.finance_accounts enable row level security;

    drop policy if exists "Contribution viewers can view accounts" on public.finance_accounts;
    drop policy if exists "Finance viewers can view accounts" on public.finance_accounts;
    drop policy if exists "Finance account viewers can view accounts" on public.finance_accounts;
    create policy "Contribution viewers can view accounts"
    on public.finance_accounts for select to authenticated
    using (public.can_view_contributions());

    drop policy if exists "Treasurers can manage accounts" on public.finance_accounts;
    drop policy if exists "Finance account managers can manage accounts" on public.finance_accounts;
    create policy "Finance account managers can manage accounts"
    on public.finance_accounts for all to authenticated
    using (public.can_manage_contributions())
    with check (public.can_manage_contributions());

    grant select on public.finance_accounts to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.bank_accounts') is not null then
    alter table public.bank_accounts enable row level security;

    drop policy if exists "Finance viewers can view bank accounts" on public.bank_accounts;
    create policy "Finance viewers can view bank accounts"
    on public.bank_accounts for select to authenticated
    using (public.can_view_contributions());

    drop policy if exists "Treasurers can manage bank accounts" on public.bank_accounts;
    create policy "Treasurers can manage bank accounts"
    on public.bank_accounts for all to authenticated
    using (public.can_manage_contributions())
    with check (public.can_manage_contributions());

    grant select on public.bank_accounts to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.cash_accounts') is not null then
    alter table public.cash_accounts enable row level security;

    drop policy if exists "Finance viewers can view cash accounts" on public.cash_accounts;
    create policy "Finance viewers can view cash accounts"
    on public.cash_accounts for select to authenticated
    using (public.can_view_contributions());

    drop policy if exists "Treasurers can manage cash accounts" on public.cash_accounts;
    create policy "Treasurers can manage cash accounts"
    on public.cash_accounts for all to authenticated
    using (public.can_manage_contributions())
    with check (public.can_manage_contributions());

    grant select on public.cash_accounts to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.finance_transactions') is not null then
    alter table public.finance_transactions enable row level security;

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

    grant select, insert, update, delete on public.finance_transactions to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.income_expenditure_reports') is not null then
    alter table public.income_expenditure_reports enable row level security;

    drop policy if exists "Finance viewers can view generated reports" on public.income_expenditure_reports;
    create policy "Finance viewers can view generated reports"
    on public.income_expenditure_reports for select to authenticated
    using (public.can_view_contributions());

    drop policy if exists "Treasurers can manage generated reports" on public.income_expenditure_reports;
    create policy "Treasurers can manage generated reports"
    on public.income_expenditure_reports for all to authenticated
    using (public.can_manage_contributions())
    with check (public.can_manage_contributions());

    grant select on public.income_expenditure_reports to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.whatsapp_payment_notification_logs') is not null then
    alter table public.whatsapp_payment_notification_logs enable row level security;

    drop policy if exists "Finance viewers can view WhatsApp payment logs" on public.whatsapp_payment_notification_logs;
    create policy "Finance viewers can view WhatsApp payment logs"
    on public.whatsapp_payment_notification_logs for select to authenticated
    using (public.can_view_contributions());

    drop policy if exists "Treasurers can manage WhatsApp payment logs" on public.whatsapp_payment_notification_logs;
    create policy "Treasurers can manage WhatsApp payment logs"
    on public.whatsapp_payment_notification_logs for all to authenticated
    using (public.can_manage_contributions())
    with check (public.can_manage_contributions());

    grant select on public.whatsapp_payment_notification_logs to authenticated;
  end if;
end $$;

grant execute on function public.can_view_contributions() to authenticated;
grant execute on function public.can_view_finance_reports() to authenticated;
grant execute on function public.can_manage_contributions() to authenticated;
grant execute on function public.can_manage_finance_records() to authenticated;
grant execute on function public.is_own_contribution(uuid) to authenticated;
