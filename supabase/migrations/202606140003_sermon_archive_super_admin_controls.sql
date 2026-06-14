begin;

drop policy if exists "Ministry team can create sermon categories" on public.sermon_categories;
drop policy if exists "Super admins can create sermon categories" on public.sermon_categories;
create policy "Super admins can create sermon categories"
on public.sermon_categories
for insert
to authenticated
with check (public.has_role('super_admin'));

drop policy if exists "Ministry team can update sermon categories" on public.sermon_categories;
drop policy if exists "Super admins can update sermon categories" on public.sermon_categories;
create policy "Super admins can update sermon categories"
on public.sermon_categories
for update
to authenticated
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

drop policy if exists "Ministry team can delete sermon categories" on public.sermon_categories;
drop policy if exists "Super admins can delete sermon categories" on public.sermon_categories;
create policy "Super admins can delete sermon categories"
on public.sermon_categories
for delete
to authenticated
using (public.has_role('super_admin'));

drop policy if exists "Authenticated users can view published sermons" on public.sermons;
drop policy if exists "Authenticated users can view published sermons and super admins can view all" on public.sermons;
create policy "Authenticated users can view published sermons and super admins can view all"
on public.sermons
for select
to authenticated
using (status = 'published' or public.has_role('super_admin'));

drop policy if exists "Ministry team can create sermons" on public.sermons;
drop policy if exists "Super admins can create sermons" on public.sermons;
create policy "Super admins can create sermons"
on public.sermons
for insert
to authenticated
with check (public.has_role('super_admin'));

drop policy if exists "Ministry team can update sermons" on public.sermons;
drop policy if exists "Super admins can update sermons" on public.sermons;
create policy "Super admins can update sermons"
on public.sermons
for update
to authenticated
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

drop policy if exists "Ministry team can delete sermons" on public.sermons;
drop policy if exists "Super admins can delete sermons" on public.sermons;
create policy "Super admins can delete sermons"
on public.sermons
for delete
to authenticated
using (public.has_role('super_admin'));

drop policy if exists "Authenticated users can view sermon media" on storage.objects;
drop policy if exists "Sermon media is viewable by authenticated users" on storage.objects;
create policy "Sermon media is viewable by authenticated users"
on storage.objects
for select
to authenticated
using (bucket_id = 'sermon-media');

drop policy if exists "Ministry team can upload sermon media" on storage.objects;
drop policy if exists "Super admins can upload sermon media" on storage.objects;
create policy "Super admins can upload sermon media"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'sermon-media' and public.has_role('super_admin'));

drop policy if exists "Ministry team can update sermon media" on storage.objects;
drop policy if exists "Super admins can update sermon media" on storage.objects;
create policy "Super admins can update sermon media"
on storage.objects
for update
to authenticated
using (bucket_id = 'sermon-media' and public.has_role('super_admin'))
with check (bucket_id = 'sermon-media' and public.has_role('super_admin'));

drop policy if exists "Ministry team can delete sermon media" on storage.objects;
drop policy if exists "Super admins can delete sermon media" on storage.objects;
create policy "Super admins can delete sermon media"
on storage.objects
for delete
to authenticated
using (bucket_id = 'sermon-media' and public.has_role('super_admin'));

grant select, insert, update, delete on public.sermon_categories to authenticated;
grant select, insert, update, delete on public.sermons to authenticated;

commit;
