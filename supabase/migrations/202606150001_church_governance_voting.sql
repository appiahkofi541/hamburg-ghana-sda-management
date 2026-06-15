begin;

create type public.governance_meeting_type as enum ('nominating_committee', 'church_election', 'church_board', 'business_meeting');
create type public.governance_vote_mode as enum ('secret_ballot', 'recorded_vote');
create type public.governance_vote_kind as enum ('yes_no_abstain', 'candidate_election');
create type public.governance_vote_status as enum ('draft', 'open', 'closed', 'certified');
create type public.governance_ballot_choice as enum ('yes', 'no', 'abstain', 'candidate');

create table if not exists public.governance_meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_type public.governance_meeting_type not null,
  title text not null,
  meeting_date date not null default current_date,
  starts_at timestamptz,
  location text,
  quorum_required integer not null default 0 check (quorum_required >= 0),
  quorum_present integer not null default 0 check (quorum_present >= 0),
  agenda text,
  minutes text,
  status text not null default 'scheduled',
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.governance_agenda_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.governance_meetings(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.governance_action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.governance_meetings(id) on delete cascade,
  action_item text not null,
  assigned_to text,
  due_date date,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.governance_attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.governance_meetings(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  attendee_name text,
  role text,
  present boolean not null default true,
  created_at timestamptz not null default now(),
  unique (meeting_id, member_id)
);

create table if not exists public.governance_committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_name text not null default 'Nominating Committee',
  member_id uuid references public.members(id) on delete cascade,
  role text,
  term_year integer not null default extract(year from current_date)::integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (committee_name, member_id, term_year)
);

create table if not exists public.governance_polls (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.governance_meetings(id) on delete cascade,
  module_type public.governance_meeting_type not null,
  vote_kind public.governance_vote_kind not null,
  vote_mode public.governance_vote_mode not null default 'secret_ballot',
  title text not null,
  description text,
  office_title text,
  quorum_required integer not null default 0 check (quorum_required >= 0),
  quorum_present integer not null default 0 check (quorum_present >= 0),
  status public.governance_vote_status not null default 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.governance_candidates (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.governance_polls(id) on delete cascade,
  member_id uuid references public.members(id) on delete set null,
  candidate_name text not null,
  office_title text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.governance_ballots (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.governance_polls(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  choice public.governance_ballot_choice not null,
  candidate_id uuid references public.governance_candidates(id) on delete set null,
  comment text,
  cast_at timestamptz not null default now(),
  unique (poll_id, member_id)
);

create table if not exists public.governance_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid default auth.uid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.can_manage_governance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(array['super_admin', 'pastor', 'church_clerk', 'secretary']::public.app_role[]);
$$;

create or replace function public.is_active_member(member_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where members.id = member_uuid
      and members.status::text = 'active'
  );
$$;

create or replace function public.is_own_active_member(member_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where members.id = member_uuid
      and members.profile_id = auth.uid()
      and members.status::text = 'active'
  );
$$;

create or replace function public.governance_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.governance_audit_log (action, entity_type, entity_id, details)
  values (lower(tg_op), tg_table_name, coalesce(new.id, old.id), jsonb_build_object('table', tg_table_name));
  return coalesce(new, old);
end;
$$;

drop trigger if exists governance_meetings_audit on public.governance_meetings;
create trigger governance_meetings_audit after insert or update or delete on public.governance_meetings
for each row execute function public.governance_audit_trigger();

drop trigger if exists governance_polls_audit on public.governance_polls;
create trigger governance_polls_audit after insert or update or delete on public.governance_polls
for each row execute function public.governance_audit_trigger();

drop trigger if exists governance_ballots_audit on public.governance_ballots;
create trigger governance_ballots_audit after insert or update or delete on public.governance_ballots
for each row execute function public.governance_audit_trigger();

create index if not exists governance_meetings_date_idx on public.governance_meetings (meeting_date desc);
create index if not exists governance_polls_status_idx on public.governance_polls (status, module_type);
create index if not exists governance_ballots_poll_idx on public.governance_ballots (poll_id);
create index if not exists governance_audit_created_idx on public.governance_audit_log (created_at desc);

alter table public.governance_meetings enable row level security;
alter table public.governance_agenda_items enable row level security;
alter table public.governance_action_items enable row level security;
alter table public.governance_attendance enable row level security;
alter table public.governance_committee_members enable row level security;
alter table public.governance_polls enable row level security;
alter table public.governance_candidates enable row level security;
alter table public.governance_ballots enable row level security;
alter table public.governance_audit_log enable row level security;

create policy "Governance records are viewable by authenticated users" on public.governance_meetings for select to authenticated using (true);
create policy "Governance managers can manage meetings" on public.governance_meetings for all to authenticated using (public.can_manage_governance()) with check (public.can_manage_governance());

create policy "Governance agenda is viewable by authenticated users" on public.governance_agenda_items for select to authenticated using (true);
create policy "Governance managers can manage agenda" on public.governance_agenda_items for all to authenticated using (public.can_manage_governance()) with check (public.can_manage_governance());

create policy "Governance actions are viewable by authenticated users" on public.governance_action_items for select to authenticated using (true);
create policy "Governance managers can manage actions" on public.governance_action_items for all to authenticated using (public.can_manage_governance()) with check (public.can_manage_governance());

create policy "Governance attendance is viewable by authenticated users" on public.governance_attendance for select to authenticated using (true);
create policy "Governance managers can manage attendance" on public.governance_attendance for all to authenticated using (public.can_manage_governance()) with check (public.can_manage_governance());

create policy "Committee members are viewable by authenticated users" on public.governance_committee_members for select to authenticated using (true);
create policy "Governance managers can manage committee members" on public.governance_committee_members for all to authenticated using (public.can_manage_governance()) with check (public.can_manage_governance());

create policy "Governance polls are viewable by authenticated users" on public.governance_polls for select to authenticated using (true);
create policy "Governance managers can manage polls" on public.governance_polls for all to authenticated using (public.can_manage_governance()) with check (public.can_manage_governance());

create policy "Governance candidates are viewable by authenticated users" on public.governance_candidates for select to authenticated using (true);
create policy "Governance managers can manage candidates" on public.governance_candidates for all to authenticated using (public.can_manage_governance()) with check (public.can_manage_governance());

create policy "Governance managers can view all ballots" on public.governance_ballots for select to authenticated using (public.can_manage_governance() or public.is_own_active_member(member_id));
create policy "Active members can cast own ballots" on public.governance_ballots for insert to authenticated with check (public.is_active_member(member_id) and (public.can_manage_governance() or public.is_own_active_member(member_id)));
create policy "Governance managers can manage ballots" on public.governance_ballots for update to authenticated using (public.can_manage_governance()) with check (public.can_manage_governance());
create policy "Governance managers can delete ballots" on public.governance_ballots for delete to authenticated using (public.can_manage_governance());

create policy "Governance audit is viewable by managers" on public.governance_audit_log for select to authenticated using (public.can_manage_governance());

grant usage on type public.governance_meeting_type, public.governance_vote_mode, public.governance_vote_kind, public.governance_vote_status, public.governance_ballot_choice to authenticated;
grant select, insert, update, delete on public.governance_meetings, public.governance_agenda_items, public.governance_action_items, public.governance_attendance, public.governance_committee_members, public.governance_polls, public.governance_candidates, public.governance_ballots to authenticated;
grant select on public.governance_audit_log to authenticated;
grant execute on function public.can_manage_governance(), public.is_active_member(uuid), public.is_own_active_member(uuid) to authenticated;

commit;
