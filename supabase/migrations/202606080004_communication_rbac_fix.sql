-- Fix Communication Module RBAC so Super Admin, Pastor, Elder, and Secretary
-- can manage communications consistently in Supabase RLS.

drop policy if exists "Communication managers can manage templates" on public.communication_templates;
drop policy if exists "Communication managers can manage campaigns" on public.communication_campaigns;
drop policy if exists "Communication managers can manage delivery logs" on public.communication_delivery_logs;
drop policy if exists "Communication managers can manage notification preferences" on public.member_notification_preferences;

create policy "Communication managers can manage templates"
on public.communication_templates for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

create policy "Communication managers can manage campaigns"
on public.communication_campaigns for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

create policy "Communication managers can manage delivery logs"
on public.communication_delivery_logs for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

create policy "Communication managers can manage notification preferences"
on public.member_notification_preferences for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);
