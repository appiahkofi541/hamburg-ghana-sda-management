-- Communication Module for Hamburg Ghana SDA Church Management System.
-- Adds announcements, Email/WhatsApp/SMS/Push campaigns, templates,
-- delivery logs, and member notification preferences.

create table if not exists public.communication_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_audience text not null default 'all_members'
    check (target_audience in ('all_members', 'department', 'leaders')),
  department_name text,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'published', 'expired')),
  scheduled_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or scheduled_at is null or expires_at >= scheduled_at)
);

create table if not exists public.communication_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'push')),
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, channel)
);

create table if not exists public.communication_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'push')),
  target_audience text not null default 'all_members'
    check (target_audience in ('all_members', 'department', 'leaders', 'individual')),
  recipient_member_id uuid references public.members(id) on delete set null,
  department_name text,
  subject text,
  message text not null,
  template_id uuid references public.communication_templates(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'pending', 'sent', 'failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communication_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.communication_campaigns(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  notification_title text not null,
  channel text not null check (channel in ('email', 'whatsapp', 'sms', 'push')),
  recipient_name text,
  recipient_contact text,
  status text not null default 'pending'
    check (status in ('pending', 'scheduled', 'sent', 'failed')),
  provider_message_id text,
  delivery_log text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.member_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members(id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  push_enabled boolean not null default true,
  quiet_hours_start time,
  quiet_hours_end time,
  updated_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists communication_announcements_set_updated_at on public.communication_announcements;
create trigger communication_announcements_set_updated_at
before update on public.communication_announcements
for each row execute function public.set_updated_at();

drop trigger if exists communication_templates_set_updated_at on public.communication_templates;
create trigger communication_templates_set_updated_at
before update on public.communication_templates
for each row execute function public.set_updated_at();

drop trigger if exists communication_campaigns_set_updated_at on public.communication_campaigns;
create trigger communication_campaigns_set_updated_at
before update on public.communication_campaigns
for each row execute function public.set_updated_at();

drop trigger if exists communication_delivery_logs_set_updated_at on public.communication_delivery_logs;
create trigger communication_delivery_logs_set_updated_at
before update on public.communication_delivery_logs
for each row execute function public.set_updated_at();

drop trigger if exists member_notification_preferences_set_updated_at on public.member_notification_preferences;
create trigger member_notification_preferences_set_updated_at
before update on public.member_notification_preferences
for each row execute function public.set_updated_at();

create index if not exists communication_announcements_status_idx on public.communication_announcements (status);
create index if not exists communication_announcements_schedule_idx on public.communication_announcements (scheduled_at);
create index if not exists communication_campaigns_channel_idx on public.communication_campaigns (channel);
create index if not exists communication_campaigns_status_idx on public.communication_campaigns (status);
create index if not exists communication_delivery_logs_campaign_idx on public.communication_delivery_logs (campaign_id);
create index if not exists communication_delivery_logs_member_idx on public.communication_delivery_logs (member_id);
create index if not exists communication_delivery_logs_status_idx on public.communication_delivery_logs (status);

alter table public.communication_announcements enable row level security;
alter table public.communication_templates enable row level security;
alter table public.communication_campaigns enable row level security;
alter table public.communication_delivery_logs enable row level security;
alter table public.member_notification_preferences enable row level security;

drop policy if exists "Members can view active communication announcements" on public.communication_announcements;
drop policy if exists "Announcement managers can manage communication announcements" on public.communication_announcements;
drop policy if exists "Communication managers can manage templates" on public.communication_templates;
drop policy if exists "Communication managers can manage campaigns" on public.communication_campaigns;
drop policy if exists "Communication managers can manage delivery logs" on public.communication_delivery_logs;
drop policy if exists "Members can view own delivery logs" on public.communication_delivery_logs;
drop policy if exists "Communication managers can manage notification preferences" on public.member_notification_preferences;
drop policy if exists "Members can manage own notification preferences" on public.member_notification_preferences;

create policy "Members can view active communication announcements"
on public.communication_announcements for select to authenticated
using (
  status in ('published', 'scheduled')
  and (expires_at is null or expires_at >= now())
);

create policy "Announcement managers can manage communication announcements"
on public.communication_announcements for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'elder', 'secretary']::public.app_role[])
);

create policy "Communication managers can manage templates"
on public.communication_templates for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary']::public.app_role[])
);

create policy "Communication managers can manage campaigns"
on public.communication_campaigns for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary']::public.app_role[])
);

create policy "Communication managers can manage delivery logs"
on public.communication_delivery_logs for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary']::public.app_role[])
);

create policy "Members can view own delivery logs"
on public.communication_delivery_logs for select to authenticated
using (
  member_id in (select id from public.members where profile_id = auth.uid())
);

create policy "Communication managers can manage notification preferences"
on public.member_notification_preferences for all to authenticated
using (
  public.has_any_role(array['super_admin', 'pastor', 'secretary']::public.app_role[])
)
with check (
  public.has_any_role(array['super_admin', 'pastor', 'secretary']::public.app_role[])
);

create policy "Members can manage own notification preferences"
on public.member_notification_preferences for all to authenticated
using (
  member_id in (select id from public.members where profile_id = auth.uid())
)
with check (
  member_id in (select id from public.members where profile_id = auth.uid())
);

grant select, insert, update, delete on public.communication_announcements to authenticated;
grant select, insert, update, delete on public.communication_templates to authenticated;
grant select, insert, update, delete on public.communication_campaigns to authenticated;
grant select, insert, update, delete on public.communication_delivery_logs to authenticated;
grant select, insert, update, delete on public.member_notification_preferences to authenticated;

insert into public.member_notification_preferences (member_id)
select id from public.members
on conflict (member_id) do nothing;

insert into public.communication_templates (name, channel, subject, body)
values
  ('Sabbath Announcement', 'email', 'Hamburg Ghana SDA Church Announcement', 'Dear member, please note this important church announcement: {{message}}'),
  ('Emergency SMS Alert', 'sms', null, 'Hamburg Ghana SDA Church alert: {{message}}'),
  ('Event WhatsApp Reminder', 'whatsapp', null, 'Dear {{name}}, reminder from Hamburg Ghana SDA Church: {{event}} starts on {{date}}.')
on conflict (name, channel) do nothing;
