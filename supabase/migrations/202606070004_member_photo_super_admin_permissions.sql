-- Ensure Super Admin is explicit in member photo upload permissions.

create or replace function public.can_manage_member_photo(object_name text)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select
    public.has_any_role(array['super_admin', 'church_clerk', 'secretary']::public.app_role[])
    or exists (
      select 1
      from public.members
      where members.id = public.member_photo_member_id(object_name)
        and members.profile_id = auth.uid()
    );
$$;

revoke execute on function public.can_manage_member_photo(text) from public;
grant execute on function public.can_manage_member_photo(text) to authenticated;

create or replace function public.update_member_profile_photo(
  target_member_id uuid,
  new_photo_url text,
  new_photo_thumbnail_url text,
  new_photo_path text,
  new_photo_thumbnail_path text
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not (
    public.has_any_role(array['super_admin', 'church_clerk', 'secretary']::public.app_role[])
    or exists (
      select 1
      from public.members
      where members.id = target_member_id
        and members.profile_id = auth.uid()
    )
  ) then
    raise exception 'You do not have permission to update this member photo.';
  end if;

  update public.members
  set
    photo_url = new_photo_url,
    photo_thumbnail_url = new_photo_thumbnail_url,
    photo_path = new_photo_path,
    photo_thumbnail_path = new_photo_thumbnail_path,
    updated_at = now()
  where id = target_member_id;
end;
$$;

revoke execute on function public.update_member_profile_photo(uuid, text, text, text, text) from public;
grant execute on function public.update_member_profile_photo(uuid, text, text, text, text) to authenticated;
