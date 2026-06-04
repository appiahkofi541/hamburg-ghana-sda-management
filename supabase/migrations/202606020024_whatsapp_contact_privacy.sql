create table public.whatsapp_contacts (
  member_id uuid primary key references public.members(id) on delete cascade,
  phone text not null,
  opted_in boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.whatsapp_contacts (member_id, phone, opted_in, consent_at)
select id, coalesce(whatsapp_phone, phone), whatsapp_opt_in, whatsapp_consent_at
from public.members
where coalesce(whatsapp_phone, phone) is not null;

alter table public.members
  drop column whatsapp_phone,
  drop column whatsapp_opt_in,
  drop column whatsapp_consent_at;

create trigger whatsapp_contacts_set_updated_at
before update on public.whatsapp_contacts
for each row execute function public.set_updated_at();

create index whatsapp_contacts_opted_in_idx on public.whatsapp_contacts (opted_in) where opted_in;

alter table public.whatsapp_contacts enable row level security;

create policy "Communication team can manage WhatsApp contacts"
on public.whatsapp_contacts for all to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

grant select, insert, update, delete on public.whatsapp_contacts to authenticated;
