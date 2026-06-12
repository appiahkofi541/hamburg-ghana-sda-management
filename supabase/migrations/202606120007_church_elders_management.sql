-- Eldership management for Church Profile & Settings.

create table if not exists public.church_elders (
  id uuid primary key default gen_random_uuid(),
  elder_name text not null,
  elder_phone text,
  elder_email text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.communication_campaigns
  add column if not exists recipient_elder_id uuid references public.church_elders(id) on delete set null;

create index if not exists church_elders_active_idx on public.church_elders (is_active, sort_order, elder_name);
create index if not exists communication_campaigns_recipient_elder_idx on public.communication_campaigns (recipient_elder_id);

drop trigger if exists church_elders_set_updated_at on public.church_elders;
create trigger church_elders_set_updated_at
before update on public.church_elders
for each row execute function public.set_updated_at();

alter table public.church_elders enable row level security;

drop policy if exists "Authenticated users can view church elders" on public.church_elders;
create policy "Authenticated users can view church elders"
on public.church_elders for select to authenticated
using (true);

drop policy if exists "Church settings admins can insert elders" on public.church_elders;
create policy "Church settings admins can insert elders"
on public.church_elders for insert to authenticated
with check (public.can_manage_church_settings());

drop policy if exists "Church settings admins can update elders" on public.church_elders;
create policy "Church settings admins can update elders"
on public.church_elders for update to authenticated
using (public.can_manage_church_settings())
with check (public.can_manage_church_settings());

drop policy if exists "Church settings admins can delete elders" on public.church_elders;
create policy "Church settings admins can delete elders"
on public.church_elders for delete to authenticated
using (public.can_manage_church_settings());

grant select, insert, update, delete on public.church_elders to authenticated;
