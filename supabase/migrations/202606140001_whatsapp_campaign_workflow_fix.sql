begin;

alter table public.whatsapp_campaigns
  add column if not exists target_audience text not null default 'all_opted_in_members',
  add column if not exists message_body text,
  add column if not exists scheduled_at timestamptz;

alter table public.whatsapp_contacts
  alter column phone drop not null;

update public.whatsapp_campaigns
set message_body = coalesce(message_body, message_preview)
where message_body is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'whatsapp_campaigns_target_audience_check'
      and conrelid = 'public.whatsapp_campaigns'::regclass
  ) then
    alter table public.whatsapp_campaigns
      add constraint whatsapp_campaigns_target_audience_check
      check (target_audience in ('all_opted_in_members', 'all_members', 'birthday_members', 'event_attendees', 'manual'));
  end if;
end $$;

create or replace function public.can_manage_whatsapp_notifications()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array[
    'super_admin',
    'admin',
    'pastor',
    'elder',
    'church_clerk',
    'secretary'
  ]::public.app_role[]);
$$;

drop policy if exists "Communication team can manage WhatsApp campaigns" on public.whatsapp_campaigns;
drop policy if exists "WhatsApp managers can manage campaigns" on public.whatsapp_campaigns;
create policy "WhatsApp managers can manage campaigns"
on public.whatsapp_campaigns
for all
to authenticated
using (public.can_manage_whatsapp_notifications())
with check (public.can_manage_whatsapp_notifications());

drop policy if exists "Communication team can manage WhatsApp deliveries" on public.whatsapp_deliveries;
drop policy if exists "WhatsApp managers can manage deliveries" on public.whatsapp_deliveries;
create policy "WhatsApp managers can manage deliveries"
on public.whatsapp_deliveries
for all
to authenticated
using (public.can_manage_whatsapp_notifications())
with check (public.can_manage_whatsapp_notifications());

drop policy if exists "Communication team can manage WhatsApp contacts" on public.whatsapp_contacts;
drop policy if exists "WhatsApp managers can manage contacts" on public.whatsapp_contacts;
create policy "WhatsApp managers can manage contacts"
on public.whatsapp_contacts
for all
to authenticated
using (public.can_manage_whatsapp_notifications())
with check (public.can_manage_whatsapp_notifications());

grant execute on function public.can_manage_whatsapp_notifications() to authenticated;
grant select, insert, update, delete on public.whatsapp_campaigns to authenticated;
grant select, insert, update, delete on public.whatsapp_deliveries to authenticated;
grant select, insert, update, delete on public.whatsapp_contacts to authenticated;

commit;
