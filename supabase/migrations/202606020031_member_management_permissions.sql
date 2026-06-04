drop policy if exists "Church leaders can manage members" on public.members;

create policy "Authorized leaders can manage members"
on public.members for all to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));
