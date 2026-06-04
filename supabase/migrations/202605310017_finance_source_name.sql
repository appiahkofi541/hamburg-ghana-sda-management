alter table public.contributions
  add column if not exists source_name text;
