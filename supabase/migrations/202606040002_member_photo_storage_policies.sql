-- Clean member photo storage policies for the public member-photos bucket.
-- Paths must be stored as: <member_id>/<filename>, for example:
-- b0000000-0000-0000-0000-000000000001/profile-1780600000000.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'member-photos',
  'member-photos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
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
    public.has_any_role(array['admin', 'secretary']::public.app_role[])
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

drop policy if exists "Authenticated users can view member photos" on storage.objects;
drop policy if exists "Leaders can upload member photos" on storage.objects;
drop policy if exists "Leaders can update member photos" on storage.objects;
drop policy if exists "Leaders can delete member photos" on storage.objects;
drop policy if exists "Member photos are viewable by authenticated users" on storage.objects;
drop policy if exists "Member photos can be inserted by owners or photo managers" on storage.objects;
drop policy if exists "Member photos can be updated by owners or photo managers" on storage.objects;
drop policy if exists "Member photos can be deleted by owners or photo managers" on storage.objects;

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
