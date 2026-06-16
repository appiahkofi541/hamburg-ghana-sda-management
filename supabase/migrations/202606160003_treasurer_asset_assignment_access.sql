-- Allow Treasurer to assign and check in assets without granting full asset administration.
-- Safe to run repeatedly.

create or replace function public.can_manage_asset_assignments()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'secretary', 'treasurer']::public.app_role[]);
$$;

create or replace function public.can_manage_asset_values()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'secretary', 'treasurer']::public.app_role[]);
$$;

do $$
begin
  if to_regclass('public.asset_assignments') is not null then
    alter table public.asset_assignments enable row level security;

    drop policy if exists "Asset managers can manage assignments" on public.asset_assignments;
    drop policy if exists "Asset assignment managers can insert assignments" on public.asset_assignments;
    drop policy if exists "Asset assignment managers can update assignments" on public.asset_assignments;
    drop policy if exists "Asset assignment managers can delete assignments" on public.asset_assignments;

    create policy "Asset assignment managers can insert assignments"
    on public.asset_assignments for insert to authenticated
    with check (public.can_manage_asset_assignments());

    create policy "Asset assignment managers can update assignments"
    on public.asset_assignments for update to authenticated
    using (public.can_manage_asset_assignments())
    with check (public.can_manage_asset_assignments());

    create policy "Asset assignment managers can delete assignments"
    on public.asset_assignments for delete to authenticated
    using (public.can_manage_asset_assignments());

    grant select, insert, update, delete on public.asset_assignments to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.assets') is not null then
    drop policy if exists "Asset managers can update assets" on public.assets;

    create policy "Asset managers can update assets"
    on public.assets for update to authenticated
    using (public.can_manage_asset_values())
    with check (public.can_manage_asset_values());

    grant select, update on public.assets to authenticated;
  end if;
end $$;

grant execute on function public.can_manage_asset_assignments() to authenticated;
grant execute on function public.can_manage_asset_values() to authenticated;
