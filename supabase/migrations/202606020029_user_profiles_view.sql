-- Keep profiles as the canonical Auth-linked table and expose a clearly named
-- access-management view for integrations and future admin tooling.
create or replace view public.user_profiles
with (security_invoker = true)
as
select
  id,
  full_name,
  email,
  phone,
  avatar_url,
  is_active,
  created_at,
  updated_at
from public.profiles;

grant select on public.user_profiles to authenticated;
