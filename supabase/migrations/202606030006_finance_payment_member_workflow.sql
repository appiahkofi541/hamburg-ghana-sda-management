alter table public.finance_transactions
add column if not exists payment_method public.payment_method not null default 'cash',
add column if not exists notes text;

create index if not exists finance_transactions_member_date_idx
on public.finance_transactions (member_id, transaction_date desc);
