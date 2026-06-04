-- Add recurrence and category support for the church calendar module.
create type public.event_recurrence as enum (
  'none',
  'weekly',
  'monthly',
  'yearly'
);

alter table public.events
  add column recurrence public.event_recurrence not null default 'none',
  add column recurrence_until date;

create index events_type_starts_at_idx on public.events (event_type, starts_at);

grant usage on type public.event_recurrence to authenticated;
