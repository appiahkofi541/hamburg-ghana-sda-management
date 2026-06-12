begin;

create or replace function public.can_manage_member_records()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role::text in ('super_admin', 'admin', 'pastor', 'elder', 'church_clerk', 'secretary')
  );
$$;

create or replace function public.can_view_member_records()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_member_records()
    or exists (
      select 1
      from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role::text in ('department_head', 'treasurer')
    );
$$;

revoke execute on function public.can_manage_member_records() from public;
revoke execute on function public.can_view_member_records() from public;
grant execute on function public.can_manage_member_records() to authenticated;
grant execute on function public.can_view_member_records() to authenticated;

do $$
begin
  if to_regclass('public.members') is not null then
    alter table public.members enable row level security;

    drop policy if exists "Member managers can view member records" on public.members;
    drop policy if exists "Member managers can insert member records" on public.members;
    drop policy if exists "Member managers can update member records" on public.members;
    drop policy if exists "Member managers can delete member records" on public.members;

    create policy "Member managers can view member records"
    on public.members for select to authenticated
    using (
      public.can_view_member_records()
      or profile_id = auth.uid()
    );

    create policy "Member managers can insert member records"
    on public.members for insert to authenticated
    with check (public.can_manage_member_records());

    create policy "Member managers can update member records"
    on public.members for update to authenticated
    using (public.can_manage_member_records())
    with check (public.can_manage_member_records());

    create policy "Member managers can delete member records"
    on public.members for delete to authenticated
    using (public.can_manage_member_records());

    grant select, insert, update, delete on public.members to authenticated;
  end if;
end $$;

do $$
begin
  if to_regclass('public.department_members') is not null then
    alter table public.department_members enable row level security;

    drop policy if exists "Member managers can view department memberships" on public.department_members;
    drop policy if exists "Member managers can insert department memberships" on public.department_members;
    drop policy if exists "Member managers can update department memberships" on public.department_members;
    drop policy if exists "Member managers can delete department memberships" on public.department_members;

    create policy "Member managers can view department memberships"
    on public.department_members for select to authenticated
    using (
      public.can_view_member_records()
      or exists (
        select 1
        from public.members
        where members.id = department_members.member_id
          and members.profile_id = auth.uid()
      )
    );

    create policy "Member managers can insert department memberships"
    on public.department_members for insert to authenticated
    with check (public.can_manage_member_records());

    create policy "Member managers can update department memberships"
    on public.department_members for update to authenticated
    using (public.can_manage_member_records())
    with check (public.can_manage_member_records());

    create policy "Member managers can delete department memberships"
    on public.department_members for delete to authenticated
    using (public.can_manage_member_records());

    grant select, insert, update, delete on public.department_members to authenticated;
  end if;
end $$;

commit;
