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
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Authenticated users can view member photos" on storage.objects;
create policy "Authenticated users can view member photos"
on storage.objects for select to authenticated
using (bucket_id = 'member-photos');

drop policy if exists "Leaders can upload member photos" on storage.objects;
create policy "Leaders can upload member photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'member-photos'
  and (
    public.has_any_role(array['admin', 'secretary']::public.app_role[])
    or exists (
      select 1
      from public.members
      where members.id::text = (storage.foldername(name))[1]
        and members.profile_id = auth.uid()
    )
  )
);

drop policy if exists "Leaders can update member photos" on storage.objects;
create policy "Leaders can update member photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'member-photos'
  and (
    public.has_any_role(array['admin', 'secretary']::public.app_role[])
    or exists (
      select 1
      from public.members
      where members.id::text = (storage.foldername(name))[1]
        and members.profile_id = auth.uid()
    )
  )
)
with check (
  bucket_id = 'member-photos'
  and (
    public.has_any_role(array['admin', 'secretary']::public.app_role[])
    or exists (
      select 1
      from public.members
      where members.id::text = (storage.foldername(name))[1]
        and members.profile_id = auth.uid()
    )
  )
);

drop policy if exists "Leaders can delete member photos" on storage.objects;
create policy "Leaders can delete member photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'member-photos'
  and (
    public.has_any_role(array['admin', 'secretary']::public.app_role[])
    or exists (
      select 1
      from public.members
      where members.id::text = (storage.foldername(name))[1]
        and members.profile_id = auth.uid()
    )
  )
);
