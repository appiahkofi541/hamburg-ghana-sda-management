-- PostgreSQL privileges define which tables are exposed to logged-in users.
-- Row-level security policies in the previous migration decide which rows and
-- operations each church role can use.
grant usage on schema public to authenticated;
grant usage on type public.app_role to authenticated;
grant usage on type public.member_status to authenticated;
grant usage on type public.attendance_status to authenticated;
grant usage on type public.contribution_type to authenticated;
grant usage on type public.payment_method to authenticated;
grant usage on type public.event_status to authenticated;
grant usage on type public.announcement_status to authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.user_roles,
  public.departments,
  public.members,
  public.department_members,
  public.attendance_sessions,
  public.attendance_entries,
  public.funds,
  public.contribution_batches,
  public.contributions,
  public.events,
  public.announcements
to authenticated;
