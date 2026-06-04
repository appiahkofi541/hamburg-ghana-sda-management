-- Funds make contribution categories configurable without losing normalized
-- contribution types. Batches match the weekly treasury recording workflow.
create table public.funds (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  contribution_type public.contribution_type not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contribution_batches (
  id uuid primary key default gen_random_uuid(),
  batch_date date not null,
  reference text unique,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.contribution_batches(id) on delete set null,
  member_id uuid references public.members(id) on delete set null,
  fund_id uuid not null references public.funds(id) on delete restrict,
  amount numeric(12, 2) not null check (amount > 0),
  contribution_date date not null,
  payment_method public.payment_method not null default 'cash',
  receipt_number text unique,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
