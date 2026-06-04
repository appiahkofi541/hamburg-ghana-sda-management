create type public.whatsapp_campaign_type as enum (
  'announcement',
  'event_reminder',
  'birthday',
  'prayer_update'
);

create type public.whatsapp_campaign_status as enum (
  'draft',
  'queued',
  'sending',
  'sent',
  'partially_failed',
  'failed'
);

create type public.whatsapp_delivery_status as enum (
  'queued',
  'sent',
  'failed'
);

alter table public.members
  add column whatsapp_phone text,
  add column whatsapp_opt_in boolean not null default false,
  add column whatsapp_consent_at timestamptz;

create table public.whatsapp_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_type public.whatsapp_campaign_type not null,
  title text not null,
  message_preview text not null,
  template_name text not null,
  template_language text not null default 'en',
  template_parameters jsonb not null default '[]'::jsonb,
  status public.whatsapp_campaign_status not null default 'draft',
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(template_parameters) = 'array')
);

create table public.whatsapp_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.whatsapp_campaigns(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  phone text not null,
  status public.whatsapp_delivery_status not null default 'queued',
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, member_id)
);

create trigger whatsapp_campaigns_set_updated_at
before update on public.whatsapp_campaigns
for each row execute function public.set_updated_at();

create trigger whatsapp_deliveries_set_updated_at
before update on public.whatsapp_deliveries
for each row execute function public.set_updated_at();

create index members_whatsapp_opt_in_idx on public.members (whatsapp_opt_in) where whatsapp_opt_in;
create index whatsapp_campaigns_created_at_idx on public.whatsapp_campaigns (created_at desc);
create index whatsapp_deliveries_campaign_id_idx on public.whatsapp_deliveries (campaign_id);

alter table public.whatsapp_campaigns enable row level security;
alter table public.whatsapp_deliveries enable row level security;

create policy "Communication team can manage WhatsApp campaigns"
on public.whatsapp_campaigns for all to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Communication team can manage WhatsApp deliveries"
on public.whatsapp_deliveries for all to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

grant usage on type public.whatsapp_campaign_type, public.whatsapp_campaign_status, public.whatsapp_delivery_status to authenticated;
grant select, insert, update, delete on public.whatsapp_campaigns to authenticated;
grant select, insert, update, delete on public.whatsapp_deliveries to authenticated;
