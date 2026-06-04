create type public.user_access_action as enum (
  'invited',
  'role_changed',
  'deactivated',
  'password_reset_requested'
);

create table public.user_access_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action public.user_access_action not null,
  details jsonb not null default '{}'::jsonb,
  performed_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index user_access_audit_user_id_idx on public.user_access_audit (user_id, created_at desc);
create index user_access_audit_created_at_idx on public.user_access_audit (created_at desc);

alter table public.user_access_audit enable row level security;

create policy "Admins can manage user access audit"
on public.user_access_audit for all to authenticated
using (public.has_role('admin'))
with check (public.has_role('admin'));

grant usage on type public.user_access_action to authenticated;
grant select, insert on public.user_access_audit to authenticated;

create or replace function public.admin_set_user_role(target_user_id uuid, new_role public.app_role)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not public.has_role('admin') then
    raise exception 'Admin access is required.';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'You cannot change your own admin access.';
  end if;

  delete from public.user_roles where user_id = target_user_id;
  insert into public.user_roles (user_id, role) values (target_user_id, new_role);
end;
$$;

revoke execute on function public.admin_set_user_role(uuid, public.app_role) from public;
grant execute on function public.admin_set_user_role(uuid, public.app_role) to authenticated;
