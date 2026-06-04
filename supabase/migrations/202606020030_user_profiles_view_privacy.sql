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
from public.profiles
where id = auth.uid()
   or public.has_role('admin');
