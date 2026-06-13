-- Departmental Budget, Expense, Budget Monitoring, and Performance tracking.

create table if not exists public.department_budgets (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  budget_year integer not null check (budget_year between 2000 and 2100),
  approved_budget_amount numeric(12, 2) not null default 0 check (approved_budget_amount >= 0),
  amount_spent numeric(12, 2) not null default 0 check (amount_spent >= 0),
  remaining_balance numeric(12, 2) generated always as (approved_budget_amount - amount_spent) stored,
  budget_status text not null default 'draft' check (budget_status in ('draft', 'approved', 'active', 'over_budget', 'closed')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (department_id, budget_year)
);

create table if not exists public.department_expenses (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  expense_date date not null default current_date,
  category text not null,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  recorded_by uuid references public.profiles(id) on delete set null,
  receipt_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.department_performance (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  period_start date not null default current_date,
  period_end date not null default current_date,
  planned_activities integer not null default 0 check (planned_activities >= 0),
  completed_activities integer not null default 0 check (completed_activities >= 0),
  attendance_count integer not null default 0 check (attendance_count >= 0),
  visitor_engagement integer not null default 0 check (visitor_engagement >= 0),
  members_involved integer not null default 0 check (members_involved >= 0),
  goals_achieved text,
  performance_status text not null default 'good' check (performance_status in ('excellent', 'good', 'needs_attention', 'at_risk')),
  notes text,
  submitted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);

create index if not exists department_budgets_department_year_idx
on public.department_budgets (department_id, budget_year desc);

create index if not exists department_budgets_status_idx
on public.department_budgets (budget_status);

create index if not exists department_expenses_department_date_idx
on public.department_expenses (department_id, expense_date desc);

create index if not exists department_expenses_recorded_by_idx
on public.department_expenses (recorded_by);

create index if not exists department_performance_department_period_idx
on public.department_performance (department_id, period_end desc);

create index if not exists department_performance_status_idx
on public.department_performance (performance_status);

create or replace function public.can_view_department_reports()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'pastor', 'secretary', 'treasurer']::public.app_role[]);
$$;

create or replace function public.can_manage_department_budgets()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_any_role(array['super_admin', 'admin', 'treasurer']::public.app_role[]);
$$;

create or replace function public.is_department_leader_for_department(target_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.departments
    where departments.id = target_department_id
      and departments.leader_id = auth.uid()
  )
  or exists (
    select 1
    from public.department_members
    join public.members
      on members.id = department_members.member_id
    where department_members.department_id = target_department_id
      and department_members.is_department_head = true
      and members.profile_id = auth.uid()
  );
$$;

create or replace function public.can_submit_department_updates(target_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.can_manage_department_budgets()
    or (
      public.has_role('department_head')
      and public.is_department_leader_for_department(target_department_id)
    );
$$;

create or replace function public.department_budget_expense_total(target_department_id uuid, target_year integer)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(department_expenses.amount), 0)
  from public.department_expenses
  where department_expenses.department_id = target_department_id
    and extract(year from department_expenses.expense_date)::integer = target_year;
$$;

create or replace function public.refresh_department_budget_spend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_department_id uuid;
  affected_year integer;
begin
  affected_department_id := coalesce(new.department_id, old.department_id);
  affected_year := extract(year from coalesce(new.expense_date, old.expense_date))::integer;

  update public.department_budgets
  set
    amount_spent = public.department_budget_expense_total(affected_department_id, affected_year),
    budget_status = case
      when public.department_budget_expense_total(affected_department_id, affected_year) > approved_budget_amount then 'over_budget'
      else budget_status
    end,
    updated_at = now()
  where department_id = affected_department_id
    and budget_year = affected_year;

  if tg_op = 'UPDATE'
    and (old.department_id is distinct from new.department_id
      or extract(year from old.expense_date)::integer is distinct from extract(year from new.expense_date)::integer)
  then
    update public.department_budgets
    set
      amount_spent = public.department_budget_expense_total(old.department_id, extract(year from old.expense_date)::integer),
      updated_at = now()
    where department_id = old.department_id
      and budget_year = extract(year from old.expense_date)::integer;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.set_department_tracking_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists department_expenses_refresh_budget_spend on public.department_expenses;
create trigger department_expenses_refresh_budget_spend
after insert or update or delete on public.department_expenses
for each row
execute function public.refresh_department_budget_spend();

drop trigger if exists set_department_budgets_updated_at on public.department_budgets;
create trigger set_department_budgets_updated_at
before update on public.department_budgets
for each row
execute function public.set_department_tracking_updated_at();

drop trigger if exists set_department_expenses_updated_at on public.department_expenses;
create trigger set_department_expenses_updated_at
before update on public.department_expenses
for each row
execute function public.set_department_tracking_updated_at();

drop trigger if exists set_department_performance_updated_at on public.department_performance;
create trigger set_department_performance_updated_at
before update on public.department_performance
for each row
execute function public.set_department_tracking_updated_at();

alter table public.department_budgets enable row level security;
alter table public.department_expenses enable row level security;
alter table public.department_performance enable row level security;

drop policy if exists "Department report viewers can view budgets" on public.department_budgets;
create policy "Department report viewers can view budgets"
on public.department_budgets for select to authenticated
using (
  public.can_view_department_reports()
  or public.is_department_leader_for_department(department_id)
);

drop policy if exists "Treasurers can manage department budgets" on public.department_budgets;
create policy "Treasurers can manage department budgets"
on public.department_budgets for all to authenticated
using (public.can_manage_department_budgets())
with check (public.can_manage_department_budgets());

drop policy if exists "Department report viewers can view expenses" on public.department_expenses;
create policy "Department report viewers can view expenses"
on public.department_expenses for select to authenticated
using (
  public.can_view_department_reports()
  or public.is_department_leader_for_department(department_id)
);

drop policy if exists "Department heads can submit expenses" on public.department_expenses;
create policy "Department heads can submit expenses"
on public.department_expenses for insert to authenticated
with check (public.can_submit_department_updates(department_id));

drop policy if exists "Department heads can update expenses" on public.department_expenses;
create policy "Department heads can update expenses"
on public.department_expenses for update to authenticated
using (public.can_submit_department_updates(department_id))
with check (public.can_submit_department_updates(department_id));

drop policy if exists "Treasurers can delete department expenses" on public.department_expenses;
create policy "Treasurers can delete department expenses"
on public.department_expenses for delete to authenticated
using (public.can_manage_department_budgets());

drop policy if exists "Department report viewers can view performance" on public.department_performance;
create policy "Department report viewers can view performance"
on public.department_performance for select to authenticated
using (
  public.can_view_department_reports()
  or public.is_department_leader_for_department(department_id)
);

drop policy if exists "Department heads can submit performance" on public.department_performance;
create policy "Department heads can submit performance"
on public.department_performance for insert to authenticated
with check (public.can_submit_department_updates(department_id));

drop policy if exists "Department heads can update performance" on public.department_performance;
create policy "Department heads can update performance"
on public.department_performance for update to authenticated
using (public.can_submit_department_updates(department_id))
with check (public.can_submit_department_updates(department_id));

drop policy if exists "Treasurers can delete department performance" on public.department_performance;
create policy "Treasurers can delete department performance"
on public.department_performance for delete to authenticated
using (public.can_manage_department_budgets());

grant select, insert, update, delete on public.department_budgets to authenticated;
grant select, insert, update, delete on public.department_expenses to authenticated;
grant select, insert, update, delete on public.department_performance to authenticated;

grant execute on function public.can_view_department_reports() to authenticated;
grant execute on function public.can_manage_department_budgets() to authenticated;
grant execute on function public.is_department_leader_for_department(uuid) to authenticated;
grant execute on function public.can_submit_department_updates(uuid) to authenticated;
grant execute on function public.department_budget_expense_total(uuid, integer) to authenticated;
