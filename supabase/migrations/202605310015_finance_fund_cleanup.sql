-- Seed the final fund after its enum value has committed and remove obsolete
-- prototype fund labels so the database matches the production UI.
insert into public.funds (name, contribution_type, description)
values ('Thanksgiving Offering', 'thanksgiving_offering', 'Thanksgiving gifts and offerings')
on conflict (name) do nothing;

delete from public.funds
where name in ('Church Offering', 'Missions', 'Special Donations', 'Welfare')
  and not exists (
    select 1 from public.contributions where contributions.fund_id = funds.id
  );
