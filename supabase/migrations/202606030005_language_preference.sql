alter table public.profiles
add column if not exists language_preference text not null default 'en'
check (language_preference in ('en', 'de'));

comment on column public.profiles.language_preference
is 'Preferred application language: en or de.';
