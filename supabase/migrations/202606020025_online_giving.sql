create type public.online_giving_status as enum ('pending', 'completed', 'cancelled', 'failed');

create sequence public.online_giving_receipt_seq;

create or replace function public.next_online_giving_receipt()
returns text language sql volatile set search_path = ''
as $$ select 'HG-OG-' || to_char(current_date, 'YYYYMM') || '-' || lpad(nextval('public.online_giving_receipt_seq')::text, 6, '0') $$;

create table public.online_giving_payments (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  fund_id uuid not null references public.funds(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency = 'EUR'),
  donor_name text not null,
  donor_email text not null,
  notes text,
  status public.online_giving_status not null default 'pending',
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_checkout_session_id text unique,
  provider_payment_intent_id text unique,
  receipt_number text not null unique default public.next_online_giving_receipt(),
  contribution_id uuid unique references public.contributions(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_webhook_events (
  id text primary key,
  provider text not null default 'stripe',
  event_type text not null,
  processed_at timestamptz not null default now()
);

create trigger online_giving_payments_set_updated_at before update on public.online_giving_payments
  for each row execute function public.set_updated_at();

create index online_giving_payments_donor_id_idx on public.online_giving_payments (donor_id, created_at desc);
create index online_giving_payments_status_idx on public.online_giving_payments (status);

alter table public.online_giving_payments enable row level security;
alter table public.payment_webhook_events enable row level security;

create policy "Members can view their online giving"
on public.online_giving_payments for select to authenticated
using (donor_id = auth.uid() or public.has_any_role(array['admin', 'pastor', 'treasurer']::public.app_role[]));

create policy "Members can start online giving"
on public.online_giving_payments for insert to authenticated
with check (donor_id = auth.uid() and status = 'pending' and provider = 'stripe');

grant usage, select on sequence public.online_giving_receipt_seq to authenticated;
grant usage on type public.online_giving_status to authenticated;
grant select, insert on public.online_giving_payments to authenticated;

insert into public.funds (name, contribution_type, description) values
  ('Offerings', 'offering', 'General online church offerings'),
  ('Mission Fund', 'missions', 'Mission support and outreach'),
  ('Health & Disaster', 'special_donation', 'Health ministry and disaster response'),
  ('Evangelism', 'special_donation', 'Evangelism campaigns and outreach'),
  ('Harvest', 'special_donation', 'Annual harvest thanksgiving support'),
  ('Dorcas', 'special_donation', 'Dorcas ministry and community care'),
  ('Systematic', 'special_donation', 'Systematic benevolence giving')
on conflict (name) do nothing;
