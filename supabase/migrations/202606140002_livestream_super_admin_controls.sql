begin;

drop policy if exists "Ministry team can update livestream settings" on public.livestream_settings;
drop policy if exists "Super admins can update livestream settings" on public.livestream_settings;
create policy "Super admins can update livestream settings"
on public.livestream_settings
for update
to authenticated
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

drop policy if exists "Authenticated users can view livestreams" on public.livestreams;
drop policy if exists "Authenticated users can view non-cancelled livestreams" on public.livestreams;
create policy "Authenticated users can view non-cancelled livestreams"
on public.livestreams
for select
to authenticated
using (status <> 'cancelled' or public.has_role('super_admin'));

drop policy if exists "Ministry team can create livestreams" on public.livestreams;
drop policy if exists "Super admins can create livestreams" on public.livestreams;
create policy "Super admins can create livestreams"
on public.livestreams
for insert
to authenticated
with check (public.has_role('super_admin'));

drop policy if exists "Ministry team can update livestreams" on public.livestreams;
drop policy if exists "Super admins can update livestreams" on public.livestreams;
create policy "Super admins can update livestreams"
on public.livestreams
for update
to authenticated
using (public.has_role('super_admin'))
with check (public.has_role('super_admin'));

drop policy if exists "Ministry team can delete livestreams" on public.livestreams;
drop policy if exists "Super admins can delete livestreams" on public.livestreams;
create policy "Super admins can delete livestreams"
on public.livestreams
for delete
to authenticated
using (public.has_role('super_admin'));

grant select, update on public.livestream_settings to authenticated;
grant select, insert, update, delete on public.livestreams to authenticated;

commit;
