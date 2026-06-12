-- Church Profile & Settings module.

create table if not exists public.church_settings (
  id boolean primary key default true,
  church_name text not null default 'Hamburg Ghana SDA Church',
  short_name text not null default 'Hamburg Ghana SDA',
  logo_url text,
  address text,
  city text,
  country text,
  postal_code text,
  phone text,
  email text,
  website text,
  pastor_name text,
  pastor_phone text,
  pastor_email text,
  secretary_name text,
  secretary_phone text,
  secretary_email text,
  treasurer_name text,
  treasurer_phone text,
  treasurer_email text,
  sabbath_service_time text,
  prayer_meeting_time text,
  default_currency text not null default 'EUR',
  default_language text not null default 'en',
  social_facebook text,
  social_youtube text,
  social_instagram text,
  social_tiktok text,
  bank_name text,
  iban text,
  account_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint church_settings_singleton check (id)
);

drop trigger if exists church_settings_set_updated_at on public.church_settings;
create trigger church_settings_set_updated_at
before update on public.church_settings
for each row execute function public.set_updated_at();

create or replace function public.can_view_church_settings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'pastor', 'secretary', 'treasurer']::public.app_role[]);
$$;

create or replace function public.can_manage_church_settings()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin']::public.app_role[]);
$$;

create or replace function public.get_public_church_profile()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(profile)
  from (
    select
      church_name,
      short_name,
      logo_url,
      address,
      city,
      country,
      postal_code,
      phone,
      email,
      website,
      pastor_name,
      sabbath_service_time,
      prayer_meeting_time,
      default_currency,
      default_language,
      social_facebook,
      social_youtube,
      social_instagram,
      social_tiktok
    from public.church_settings
    where id = true
  ) profile;
$$;

alter table public.church_settings enable row level security;

drop policy if exists "Church settings viewers can view settings" on public.church_settings;
create policy "Church settings viewers can view settings"
on public.church_settings for select to authenticated
using (public.can_view_church_settings());

drop policy if exists "Church settings admins can insert settings" on public.church_settings;
create policy "Church settings admins can insert settings"
on public.church_settings for insert to authenticated
with check (public.can_manage_church_settings());

drop policy if exists "Church settings admins can update settings" on public.church_settings;
create policy "Church settings admins can update settings"
on public.church_settings for update to authenticated
using (public.can_manage_church_settings())
with check (public.can_manage_church_settings());

drop policy if exists "Church settings admins can delete settings" on public.church_settings;
create policy "Church settings admins can delete settings"
on public.church_settings for delete to authenticated
using (public.can_manage_church_settings());

grant select, insert, update, delete on public.church_settings to authenticated;
grant execute on function public.can_view_church_settings() to authenticated;
grant execute on function public.can_manage_church_settings() to authenticated;
grant execute on function public.get_public_church_profile() to anon, authenticated;

insert into public.church_settings (
  id,
  church_name,
  short_name,
  address,
  city,
  country,
  postal_code,
  email,
  website,
  sabbath_service_time,
  prayer_meeting_time,
  default_currency,
  default_language,
  notes
)
values (
  true,
  'Hamburg Ghana SDA Church',
  'Hamburg Ghana SDA',
  'Hamburg',
  'Hamburg',
  'Germany',
  '',
  '',
  'https://hamburg-ghana-sda-management.vercel.app',
  'Saturday 09:30',
  'Wednesday 19:00',
  'EUR',
  'en',
  'Default church profile seed record.'
)
on conflict (id) do update
set church_name = excluded.church_name,
    short_name = excluded.short_name,
    updated_at = now();
