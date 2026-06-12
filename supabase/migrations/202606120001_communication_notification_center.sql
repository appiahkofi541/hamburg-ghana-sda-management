-- Communication & Notification Center expansion.
-- Adds visitor and role audiences, reminder categories, richer delivery logs,
-- and default templates for automated church reminders.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.communication_campaigns'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%target_audience%';

  if constraint_name is not null then
    execute format('alter table public.communication_campaigns drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.communication_campaigns
  add column if not exists recipient_visitor_id uuid references public.visitors(id) on delete set null,
  add column if not exists role_name text,
  add column if not exists reminder_type text not null default 'general',
  add column if not exists recipient_count integer not null default 0,
  add column if not exists sent_count integer not null default 0,
  add column if not exists failed_count integer not null default 0,
  add constraint communication_campaigns_target_audience_check
    check (target_audience in ('all_members', 'all_visitors', 'department', 'role', 'leaders', 'individual')),
  add constraint communication_campaigns_reminder_type_check
    check (reminder_type in ('general', 'event_reminder', 'baptism_class_reminder', 'visitor_follow_up', 'birthday_greeting', 'sabbath_service', 'prayer_meeting', 'prayer_request', 'contribution_receipt'));

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.communication_delivery_logs'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%channel%';

  if constraint_name is not null then
    execute format('alter table public.communication_delivery_logs drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.communication_delivery_logs
  add column if not exists visitor_id uuid references public.visitors(id) on delete set null,
  add column if not exists recipient_role text,
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists delivered_at timestamptz,
  add column if not exists opened_at timestamptz,
  add constraint communication_delivery_logs_channel_check
    check (channel in ('email', 'whatsapp', 'sms', 'push')),
  add constraint communication_delivery_logs_delivery_status_check
    check (delivery_status in ('pending', 'scheduled', 'sent', 'delivered', 'opened', 'failed'));

create index if not exists communication_campaigns_audience_idx on public.communication_campaigns (target_audience, role_name);
create index if not exists communication_campaigns_reminder_idx on public.communication_campaigns (reminder_type, scheduled_at);
create index if not exists communication_delivery_logs_visitor_idx on public.communication_delivery_logs (visitor_id);
create index if not exists communication_delivery_logs_delivery_status_idx on public.communication_delivery_logs (delivery_status);

drop policy if exists "Communication managers can manage templates" on public.communication_templates;
create policy "Communication managers can manage templates"
on public.communication_templates for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'treasurer']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'treasurer']::public.app_role[])
);

drop policy if exists "Communication managers can manage campaigns" on public.communication_campaigns;
create policy "Communication managers can manage campaigns"
on public.communication_campaigns for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'treasurer']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'treasurer']::public.app_role[])
);

drop policy if exists "Communication managers can manage delivery logs" on public.communication_delivery_logs;
create policy "Communication managers can manage delivery logs"
on public.communication_delivery_logs for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'treasurer']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'treasurer']::public.app_role[])
);

drop policy if exists "Communication managers can manage notification preferences" on public.member_notification_preferences;
create policy "Communication managers can manage notification preferences"
on public.member_notification_preferences for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'treasurer']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary', 'treasurer']::public.app_role[])
);

insert into public.communication_templates (name, channel, subject, body)
values
  ('Birthday Template', 'email', 'Happy Birthday from Hamburg Ghana SDA Church', 'Dear {{name}}, happy birthday. May God bless you richly in this new year of life.'),
  ('Birthday WhatsApp Template', 'whatsapp', null, 'Happy birthday {{name}}. Hamburg Ghana SDA Church celebrates you today.'),
  ('Event Reminder Template', 'email', 'Reminder: {{event}}', 'Dear {{name}}, this is a reminder that {{event}} is scheduled for {{date}} at {{time}}.'),
  ('Event Reminder WhatsApp Template', 'whatsapp', null, 'Reminder: {{event}} begins on {{date}} at {{time}}. We look forward to seeing you.'),
  ('Sabbath Reminder Template', 'whatsapp', null, 'Happy Sabbath. Divine Service begins at {{time}}. Hamburg Ghana SDA Church welcomes you.'),
  ('Visitor Follow-up Template', 'email', 'Thank you for visiting Hamburg Ghana SDA Church', 'Dear {{name}}, thank you for worshipping with us. We would love to stay connected and support your spiritual journey.'),
  ('Visitor Follow-up WhatsApp Template', 'whatsapp', null, 'Hello {{name}}, thank you for visiting Hamburg Ghana SDA Church. We hope to see you again soon.'),
  ('Prayer Request Template', 'email', 'Prayer Request Update', 'Dear {{name}}, your prayer request has been received. Our pastoral team is praying with you.'),
  ('Prayer Meeting Reminder Template', 'sms', null, 'Reminder: Prayer meeting is scheduled for {{date}} at {{time}}. Hamburg Ghana SDA Church.'),
  ('Contribution Receipt Template', 'email', 'Contribution Receipt from Hamburg Ghana SDA Church', 'Dear {{name}}, thank you for your contribution of {{amount}}. May God bless your faithfulness.'),
  ('Bulk SMS Template', 'sms', null, 'Hamburg Ghana SDA Church: {{message}}')
on conflict (name, channel) do update
set
  subject = excluded.subject,
  body = excluded.body,
  is_active = true,
  updated_at = now();
