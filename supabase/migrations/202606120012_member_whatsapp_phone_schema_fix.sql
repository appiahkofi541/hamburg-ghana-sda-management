begin;

alter table public.members
  add column if not exists whatsapp_phone text;

do $$
begin
  if to_regclass('public.whatsapp_contacts') is not null then
    update public.members
    set whatsapp_phone = whatsapp_contacts.phone
    from public.whatsapp_contacts
    where whatsapp_contacts.member_id = members.id
      and members.whatsapp_phone is null
      and whatsapp_contacts.phone is not null;
  end if;
end $$;

create index if not exists members_whatsapp_phone_idx
on public.members (whatsapp_phone)
where whatsapp_phone is not null;

grant select, insert, update on public.members to authenticated;

commit;
