begin;

create or replace function public.can_manage_communications()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'secretary', 'treasurer']::public.app_role[]);
$$;

revoke execute on function public.can_manage_communications() from public;
grant execute on function public.can_manage_communications() to authenticated;

do $$
begin
  if to_regclass('public.communication_templates') is not null then
    alter table public.communication_templates enable row level security;
    drop policy if exists "Communication managers can manage templates" on public.communication_templates;
    create policy "Communication managers can manage templates"
    on public.communication_templates for all to authenticated
    using (public.can_manage_communications())
    with check (public.can_manage_communications());
    grant select, insert, update, delete on public.communication_templates to authenticated;
  end if;

  if to_regclass('public.communication_campaigns') is not null then
    alter table public.communication_campaigns enable row level security;
    drop policy if exists "Communication managers can manage campaigns" on public.communication_campaigns;
    create policy "Communication managers can manage campaigns"
    on public.communication_campaigns for all to authenticated
    using (public.can_manage_communications())
    with check (public.can_manage_communications());
    grant select, insert, update, delete on public.communication_campaigns to authenticated;
  end if;

  if to_regclass('public.communication_delivery_logs') is not null then
    alter table public.communication_delivery_logs enable row level security;
    drop policy if exists "Communication managers can manage delivery logs" on public.communication_delivery_logs;
    create policy "Communication managers can manage delivery logs"
    on public.communication_delivery_logs for all to authenticated
    using (public.can_manage_communications())
    with check (public.can_manage_communications());
    grant select, insert, update, delete on public.communication_delivery_logs to authenticated;
  end if;

  if to_regclass('public.member_notification_preferences') is not null then
    alter table public.member_notification_preferences enable row level security;
    drop policy if exists "Communication managers can manage notification preferences" on public.member_notification_preferences;
    create policy "Communication managers can manage notification preferences"
    on public.member_notification_preferences for all to authenticated
    using (public.can_manage_communications())
    with check (public.can_manage_communications());
    grant select, insert, update, delete on public.member_notification_preferences to authenticated;
  end if;
end $$;

commit;
