-- Priority 2: Member profile photo upload using Supabase Storage.
-- Storage paths are scoped by member id:
-- <member_id>/profile-<timestamp>.<ext>
-- <member_id>/thumbnail-<timestamp>.jpg

alter table public.members
add column if not exists photo_url text,
add column if not exists photo_thumbnail_url text,
add column if not exists photo_path text,
add column if not exists photo_thumbnail_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-photos',
  'member-photos',
  true,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 4194304,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create or replace function public.member_photo_member_id(object_name text)
returns uuid
language plpgsql
stable
security definer set search_path = ''
as $$
declare
  first_folder text;
begin
  first_folder := split_part(object_name, '/', 1);

  if first_folder = '' or first_folder = 'private' then
    return null;
  end if;

  return first_folder::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.can_manage_member_photo(object_name text)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select
    public.has_any_role(array['church_clerk', 'secretary']::public.app_role[])
    or exists (
      select 1
      from public.members
      where members.id = public.member_photo_member_id(object_name)
        and members.profile_id = auth.uid()
    );
$$;

revoke execute on function public.member_photo_member_id(text) from public;
revoke execute on function public.can_manage_member_photo(text) from public;
grant execute on function public.member_photo_member_id(text) to authenticated;
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
    public.has_any_role(array['church_clerk', 'secretary']::public.app_role[])
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

drop policy if exists "Authenticated users can view member photos" on storage.objects;
drop policy if exists "Leaders can upload member photos" on storage.objects;
drop policy if exists "Leaders can update member photos" on storage.objects;
drop policy if exists "Leaders can delete member photos" on storage.objects;
drop policy if exists "Member photos are viewable by authenticated users" on storage.objects;
drop policy if exists "Member photos can be inserted by owners or photo managers" on storage.objects;
drop policy if exists "Member photos can be updated by owners or photo managers" on storage.objects;
drop policy if exists "Member photos can be deleted by owners or photo managers" on storage.objects;
drop policy if exists "Authorized users can insert member photos" on storage.objects;
drop policy if exists "Authorized users can update member photos" on storage.objects;
drop policy if exists "Authorized users can delete member photos" on storage.objects;

create policy "Member photos are viewable by authenticated users"
on storage.objects for select to authenticated
using (bucket_id = 'member-photos');

create policy "Member photos can be inserted by owners or photo managers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-photos'
  and public.member_photo_member_id(name) is not null
  and public.can_manage_member_photo(name)
);

create policy "Member photos can be updated by owners or photo managers"
on storage.objects for update to authenticated
using (
  bucket_id = 'member-photos'
  and public.member_photo_member_id(name) is not null
  and public.can_manage_member_photo(name)
)
with check (
  bucket_id = 'member-photos'
  and public.member_photo_member_id(name) is not null
  and public.can_manage_member_photo(name)
);

create policy "Member photos can be deleted by owners or photo managers"
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-photos'
  and public.member_photo_member_id(name) is not null
  and public.can_manage_member_photo(name)
);
