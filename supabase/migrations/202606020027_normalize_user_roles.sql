-- New Auth users begin as members. Once an elevated role is assigned, remove
-- that default row so the database has one unambiguous membership baseline.
create or replace function public.normalize_member_role()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.user_roles
    where user_id = new.user_id
      and role <> 'member'
  ) then
    delete from public.user_roles
    where user_id = new.user_id
      and role = 'member';
  end if;

  return new;
end;
$$;

revoke execute on function public.normalize_member_role() from public;

create trigger normalize_user_member_role
after insert or update of role on public.user_roles
for each row execute procedure public.normalize_member_role();

delete from public.user_roles
where role = 'member'
  and exists (
    select 1
    from public.user_roles elevated
    where elevated.user_id = user_roles.user_id
      and elevated.role <> 'member'
  );
