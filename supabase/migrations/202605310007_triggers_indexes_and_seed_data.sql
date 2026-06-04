-- Keep modified records auditable without relying on application code.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger set_departments_updated_at before update on public.departments
  for each row execute procedure public.set_updated_at();
create trigger set_members_updated_at before update on public.members
  for each row execute procedure public.set_updated_at();
create trigger set_attendance_sessions_updated_at before update on public.attendance_sessions
  for each row execute procedure public.set_updated_at();
create trigger set_funds_updated_at before update on public.funds
  for each row execute procedure public.set_updated_at();
create trigger set_contribution_batches_updated_at before update on public.contribution_batches
  for each row execute procedure public.set_updated_at();
create trigger set_contributions_updated_at before update on public.contributions
  for each row execute procedure public.set_updated_at();
create trigger set_events_updated_at before update on public.events
  for each row execute procedure public.set_updated_at();
create trigger set_announcements_updated_at before update on public.announcements
  for each row execute procedure public.set_updated_at();

create index profiles_email_idx on public.profiles (lower(email));
create index user_roles_role_idx on public.user_roles (role);
create index departments_leader_id_idx on public.departments (leader_id);
create index members_full_name_idx on public.members (lower(full_name));
create index members_status_idx on public.members (status);
create index department_members_member_id_idx on public.department_members (member_id);
create index attendance_sessions_service_date_idx on public.attendance_sessions (service_date desc);
create index attendance_entries_session_id_idx on public.attendance_entries (session_id);
create index contributions_date_idx on public.contributions (contribution_date desc);
create index contributions_member_id_idx on public.contributions (member_id);
create index contributions_fund_id_idx on public.contributions (fund_id);
create index events_starts_at_idx on public.events (starts_at);
create index announcements_published_at_idx on public.announcements (published_at desc);

insert into public.funds (name, contribution_type, description)
values
  ('Tithe', 'tithe', 'Regular tithe contributions'),
  ('Church Offering', 'offering', 'General church offering'),
  ('Building Fund', 'building_fund', 'Church building and facilities fund'),
  ('Missions', 'missions', 'Mission and evangelism support'),
  ('Welfare', 'welfare', 'Member welfare and community support');
