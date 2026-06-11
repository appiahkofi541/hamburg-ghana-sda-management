-- Keep the Pastor Dashboard active department count aligned with live departments.
-- Legacy SDA defaults remain available for history/reactivation, but only the
-- current Hamburg Ghana SDA departments should be marked active.

with active_departments(name) as (
  values
    ('Deacons'),
    ('Secretariat'),
    ('Sabbath School'),
    ('Youth Ministry'),
    ('Choir'),
    ('Media Ministry')
)
update public.departments
set
  is_active = exists (
    select 1
    from active_departments
    where active_departments.name = public.departments.name
  ),
  updated_at = now()
where is_active is distinct from exists (
  select 1
  from active_departments
  where active_departments.name = public.departments.name
);
