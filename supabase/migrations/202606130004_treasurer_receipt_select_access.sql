-- Ensure contribution receipt pages can read the canonical transaction row and
-- related display data for authorized finance viewers.

create or replace function public.can_view_contributions()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'pastor', 'elder', 'treasurer']::public.app_role[]);
$$;

create or replace function public.set_finance_transaction_reference_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reference_number is null or btrim(new.reference_number) = '' then
    new.reference_number := 'HG-' || to_char(coalesce(new.transaction_date, current_date), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;

  return new;
end;
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
  if to_regclass('public.finance_transactions') is not null then
    update public.finance_transactions
    set reference_number = 'HG-' || to_char(coalesce(transaction_date, current_date), 'YYYYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 8))
    where reference_number is null or btrim(reference_number) = '';

    alter table public.finance_transactions enable row level security;

    drop trigger if exists set_finance_transaction_reference_number on public.finance_transactions;
    create trigger set_finance_transaction_reference_number
    before insert on public.finance_transactions
    for each row
    execute function public.set_finance_transaction_reference_number();

    drop policy if exists "Receipt viewers can select finance transactions" on public.finance_transactions;
    create policy "Receipt viewers can select finance transactions"
    on public.finance_transactions for select to authenticated
    using (
      public.can_view_contributions()
      or public.is_own_contribution(member_id)
    );

    grant select on public.finance_transactions to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.finance_accounts') is not null then
    alter table public.finance_accounts enable row level security;

    drop policy if exists "Receipt viewers can select finance accounts" on public.finance_accounts;
    create policy "Receipt viewers can select finance accounts"
    on public.finance_accounts for select to authenticated
    using (public.can_view_contributions());

    grant select on public.finance_accounts to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.finance_categories') is not null then
    alter table public.finance_categories enable row level security;

    drop policy if exists "Receipt viewers can select finance categories" on public.finance_categories;
    create policy "Receipt viewers can select finance categories"
    on public.finance_categories for select to authenticated
    using (is_active or public.can_view_contributions());

    grant select on public.finance_categories to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.members') is not null then
    alter table public.members enable row level security;

    drop policy if exists "Receipt viewers can select member receipt details" on public.members;
    create policy "Receipt viewers can select member receipt details"
    on public.members for select to authenticated
    using (
      public.can_view_contributions()
      or profile_id = auth.uid()
    );

    grant select on public.members to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles enable row level security;

    drop policy if exists "Receipt viewers can select recorder profiles" on public.profiles;
    create policy "Receipt viewers can select recorder profiles"
    on public.profiles for select to authenticated
    using (public.can_view_contributions() or id = auth.uid());

    grant select on public.profiles to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.whatsapp_payment_notification_logs') is not null then
    alter table public.whatsapp_payment_notification_logs enable row level security;

    drop policy if exists "Receipt viewers can select payment notification logs" on public.whatsapp_payment_notification_logs;
    create policy "Receipt viewers can select payment notification logs"
    on public.whatsapp_payment_notification_logs for select to authenticated
    using (public.can_view_contributions());

    grant select on public.whatsapp_payment_notification_logs to authenticated;
  end if;
end $$;

grant execute on function public.can_view_contributions() to authenticated;
grant execute on function public.is_own_contribution(uuid) to authenticated;
