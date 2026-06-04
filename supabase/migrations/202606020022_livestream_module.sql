create type public.livestream_status as enum (
  'scheduled',
  'live',
  'completed',
  'cancelled'
);

create table public.livestream_settings (
  id text primary key default 'church',
  youtube_channel_name text not null default 'Hamburg Ghana SDA Church',
  youtube_channel_url text,
  updated_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (id = 'church')
);

create table public.livestreams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  youtube_url text not null,
  youtube_embed_url text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status public.livestream_status not null default 'scheduled',
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create trigger livestream_settings_set_updated_at
before update on public.livestream_settings
for each row execute function public.set_updated_at();

create trigger livestreams_set_updated_at
before update on public.livestreams
for each row execute function public.set_updated_at();

create index livestreams_starts_at_idx on public.livestreams (starts_at desc);
create index livestreams_status_idx on public.livestreams (status);

alter table public.livestream_settings enable row level security;
alter table public.livestreams enable row level security;

create policy "Authenticated users can view livestream settings"
on public.livestream_settings for select to authenticated using (true);

create policy "Ministry team can update livestream settings"
on public.livestream_settings for update to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Authenticated users can view livestreams"
on public.livestreams for select to authenticated
using (
  status <> 'cancelled'
  or public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[])
);

create policy "Ministry team can create livestreams"
on public.livestreams for insert to authenticated
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Ministry team can update livestreams"
on public.livestreams for update to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Ministry team can delete livestreams"
on public.livestreams for delete to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

grant usage on type public.livestream_status to authenticated;
grant select, update on public.livestream_settings to authenticated;
grant select, insert, update, delete on public.livestreams to authenticated;

insert into public.livestream_settings (id)
values ('church')
on conflict (id) do nothing;
