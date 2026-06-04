-- Remove permissive policies if an earlier draft of migration 016 was applied.
-- Department Heads should only update the department where they are leader.
drop policy if exists "Department heads can create departments" on public.departments;
drop policy if exists "Department heads can delete departments" on public.departments;
drop policy if exists "Elders and department heads can update departments" on public.departments;
