-- WhatsApp payment receipts for the finance module.
do $$ begin
  alter type public.finance_transaction_type add value if not exists 'welfare';
  alter type public.finance_transaction_type add value if not exists 'other_church_payment';
exception when undefined_object then null;
end $$;

do $$ begin
  create type public.whatsapp_payment_notification_status as enum ('pending', 'sent', 'failed');
exception when duplicate_object then null;
end $$;

alter table public.members
  add column if not exists whatsapp_phone text;

update public.members
set whatsapp_phone = contacts.phone
from public.whatsapp_contacts contacts
where contacts.member_id = members.id
  and members.whatsapp_phone is null;

create table if not exists public.whatsapp_payment_settings (
  id boolean primary key default true check (id),
  phone_number_id text,
  access_token text,
  default_template_name text,
  template_language text not null default 'en',
  auto_notifications_enabled boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_payment_notification_logs (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  payment_id uuid references public.finance_transactions(id) on delete cascade,
  phone_number text not null,
  message text not null,
  status public.whatsapp_payment_notification_status not null default 'pending',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id)
);

drop trigger if exists whatsapp_payment_settings_set_updated_at on public.whatsapp_payment_settings;
create trigger whatsapp_payment_settings_set_updated_at
before update on public.whatsapp_payment_settings
for each row execute function public.set_updated_at();

drop trigger if exists whatsapp_payment_notification_logs_set_updated_at on public.whatsapp_payment_notification_logs;
create trigger whatsapp_payment_notification_logs_set_updated_at
before update on public.whatsapp_payment_notification_logs
for each row execute function public.set_updated_at();

alter table public.whatsapp_payment_settings enable row level security;
alter table public.whatsapp_payment_notification_logs enable row level security;

-- Settings are managed through server API routes so the token is never exposed
-- through browser Supabase queries.
revoke all on public.whatsapp_payment_settings from authenticated;
revoke all on public.whatsapp_payment_settings from anon;

drop policy if exists "Finance viewers can view WhatsApp payment logs" on public.whatsapp_payment_notification_logs;
create policy "Finance viewers can view WhatsApp payment logs"
on public.whatsapp_payment_notification_logs for select to authenticated
using (public.has_any_role(array['admin', 'treasurer']::public.app_role[]));

drop policy if exists "Treasurers can manage WhatsApp payment logs" on public.whatsapp_payment_notification_logs;
create policy "Treasurers can manage WhatsApp payment logs"
on public.whatsapp_payment_notification_logs for all to authenticated
using (public.has_role('treasurer'))
with check (public.has_role('treasurer'));

grant usage on type public.whatsapp_payment_notification_status to authenticated;
grant select, insert, update, delete on public.whatsapp_payment_notification_logs to authenticated;

insert into public.whatsapp_payment_settings (id, default_template_name, template_language, auto_notifications_enabled)
values (true, 'payment_receipt', 'en', false)
on conflict (id) do nothing;

create or replace function public.finance_apply_transaction_balance_insert(row_value public.finance_transactions)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if row_value.transaction_type::text in ('income', 'tithe', 'offering', 'donation', 'welfare', 'other_church_payment') then
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
  if row_value.transaction_type::text in ('income', 'tithe', 'offering', 'donation', 'welfare', 'other_church_payment') then
    update public.finance_accounts set current_balance = current_balance - row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type::text in ('expenditure', 'expense') then
    update public.finance_accounts set current_balance = current_balance + row_value.amount where id = row_value.account_id;
  elsif row_value.transaction_type::text = 'transfer' then
    update public.finance_accounts set current_balance = current_balance + row_value.amount where id = row_value.account_id;
    update public.finance_accounts set current_balance = current_balance - row_value.amount where id = row_value.transfer_to_account_id;
  end if;
end;
$$;

create or replace function public.finance_apply_transaction_balance()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.finance_apply_transaction_balance_insert(new);
    return new;
  end if;

  if tg_op = 'DELETE' then
    perform public.finance_apply_transaction_balance_delete(old);
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

create index if not exists whatsapp_payment_logs_member_idx on public.whatsapp_payment_notification_logs (member_id);
create index if not exists whatsapp_payment_logs_payment_idx on public.whatsapp_payment_notification_logs (payment_id);
create index if not exists whatsapp_payment_logs_status_idx on public.whatsapp_payment_notification_logs (status);
