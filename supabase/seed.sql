-- Hamburg Ghana SDA Church demo data.
-- Apply after all migrations. Safe to run repeatedly in a test project.
-- Shared demo password: DemoPass123!

begin;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@hamburgghanasda.demo', crypt('DemoPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ama Admin"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pastor@hamburgghanasda.demo', crypt('DemoPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Pastor Emmanuel Darko"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'treasurer@hamburgghanasda.demo', crypt('DemoPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Ruth Amoah"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'secretary@hamburgghanasda.demo', crypt('DemoPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Grace Appiah"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'departmenthead@hamburgghanasda.demo', crypt('DemoPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Samuel Asare"}', now(), now(), '', '', '', ''),
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@hamburgghanasda.demo', crypt('DemoPass123!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Akosua Boateng"}', now(), now(), '', '', '', '')
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change = excluded.email_change,
  email_change_token_new = excluded.email_change_token_new,
  updated_at = now();

insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
values
  ('f0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@hamburgghanasda.demo"}', 'email', now(), now(), now()),
  ('f0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', '{"sub":"a0000000-0000-0000-0000-000000000002","email":"pastor@hamburgghanasda.demo"}', 'email', now(), now(), now()),
  ('f0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', '{"sub":"a0000000-0000-0000-0000-000000000003","email":"treasurer@hamburgghanasda.demo"}', 'email', now(), now(), now()),
  ('f0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', '{"sub":"a0000000-0000-0000-0000-000000000004","email":"secretary@hamburgghanasda.demo"}', 'email', now(), now(), now()),
  ('f0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', '{"sub":"a0000000-0000-0000-0000-000000000005","email":"departmenthead@hamburgghanasda.demo"}', 'email', now(), now(), now()),
  ('f0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', '{"sub":"a0000000-0000-0000-0000-000000000006","email":"member@hamburgghanasda.demo"}', 'email', now(), now(), now())
on conflict (id) do update set
  provider_id = excluded.provider_id,
  identity_data = excluded.identity_data,
  updated_at = now();

insert into public.profiles (id, full_name, email)
values
  ('a0000000-0000-0000-0000-000000000001', 'Ama Admin', 'admin@hamburgghanasda.demo'),
  ('a0000000-0000-0000-0000-000000000002', 'Pastor Emmanuel Darko', 'pastor@hamburgghanasda.demo'),
  ('a0000000-0000-0000-0000-000000000003', 'Ruth Amoah', 'treasurer@hamburgghanasda.demo'),
  ('a0000000-0000-0000-0000-000000000004', 'Grace Appiah', 'secretary@hamburgghanasda.demo'),
  ('a0000000-0000-0000-0000-000000000005', 'Samuel Asare', 'departmenthead@hamburgghanasda.demo'),
  ('a0000000-0000-0000-0000-000000000006', 'Akosua Boateng', 'member@hamburgghanasda.demo')
on conflict (id) do update set full_name = excluded.full_name, email = excluded.email;

delete from public.user_roles
where user_id in (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000003',
  'a0000000-0000-0000-0000-000000000004',
  'a0000000-0000-0000-0000-000000000005',
  'a0000000-0000-0000-0000-000000000006'
);

-- Keep each demo account unambiguous: the UI may support multiple ministry
-- roles, but the baseline member role is not retained for elevated accounts.
insert into public.user_roles (user_id, role)
values
  ('a0000000-0000-0000-0000-000000000001', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'pastor'),
  ('a0000000-0000-0000-0000-000000000003', 'treasurer'),
  ('a0000000-0000-0000-0000-000000000004', 'secretary'),
  ('a0000000-0000-0000-0000-000000000005', 'department_head'),
  ('a0000000-0000-0000-0000-000000000006', 'member');

insert into public.departments (name, description, meeting_schedule)
values
  ('Elders', 'Spiritual leadership and pastoral support', 'First Sunday, 17:00'),
  ('Deacons', 'Church service, hospitality, and practical support', 'Second Sunday, 16:00'),
  ('Treasury', 'Financial stewardship and reporting', 'Monthly after Sabbath service'),
  ('Secretariat', 'Church records and administration', 'First Monday, 18:30'),
  ('Sabbath School', 'Bible study and Sabbath School coordination', 'Sabbath, 09:30'),
  ('Youth Ministry', 'Programs and discipleship for youth and young adults', 'Saturdays, 16:00'),
  ('Choir', 'Worship music and choir ministry', 'Fridays, 18:30'),
  ('Media Ministry', 'Audio, visual, streaming, and communications support', 'Saturdays, 08:30')
on conflict (name) do update set
  description = excluded.description,
  meeting_schedule = excluded.meeting_schedule;

update public.departments
set leader_id = 'a0000000-0000-0000-0000-000000000005'
where name = 'Youth Ministry';

insert into public.members (
  id, member_number, profile_id, first_name, last_name, full_name, gender,
  date_of_birth, phone, email, address_line, baptism_status, baptism_date,
  marital_status, occupation, status, joined_on
)
values
  ('b0000000-0000-0000-0000-000000000001', 'HG-001', null, 'Kwame', 'Mensah', 'Kwame Mensah', 'male', '1982-04-16', '+49 176 482 0193', 'kwame.mensah@example.com', 'Hamburg, Germany', true, '2001-08-11', 'married', 'Engineer', 'active', '2021-01-14'),
  ('b0000000-0000-0000-0000-000000000002', 'HG-002', 'a0000000-0000-0000-0000-000000000006', 'Akosua', 'Boateng', 'Akosua Boateng', 'female', '1990-09-03', '+49 157 594 2281', 'member@hamburgghanasda.demo', 'Hamburg, Germany', true, '2007-05-19', 'single', 'Teacher', 'active', '2022-03-02'),
  ('b0000000-0000-0000-0000-000000000003', 'HG-003', 'a0000000-0000-0000-0000-000000000005', 'Samuel', 'Asare', 'Samuel Asare', 'male', '1988-12-21', '+49 176 319 8724', 'departmenthead@hamburgghanasda.demo', 'Hamburg, Germany', true, '2005-07-09', 'married', 'Accountant', 'active', '2020-11-18'),
  ('b0000000-0000-0000-0000-000000000004', 'HG-004', null, 'Esi', 'Owusu', 'Esi Owusu', 'female', '1985-06-12', '+49 152 737 4309', 'esi.owusu@example.com', 'Hamburg, Germany', true, '2002-03-23', 'married', 'Nurse', 'active', '2023-08-26'),
  ('b0000000-0000-0000-0000-000000000005', 'HG-005', null, 'Daniel', 'Ofori', 'Daniel Ofori', 'male', '1998-02-09', '+49 176 967 5110', 'daniel.ofori@example.com', 'Hamburg, Germany', true, '2016-10-15', 'single', 'Designer', 'active', '2026-05-10'),
  ('b0000000-0000-0000-0000-000000000006', 'HG-006', null, 'Adwoa', 'Nyarko', 'Adwoa Nyarko', 'female', '1994-07-18', '+49 176 234 9981', 'adwoa.nyarko@example.com', 'Hamburg, Germany', false, null, 'single', 'Student', 'active', '2026-04-04')
on conflict (member_number) do update set
  profile_id = excluded.profile_id,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  full_name = excluded.full_name,
  gender = excluded.gender,
  date_of_birth = excluded.date_of_birth,
  phone = excluded.phone,
  email = excluded.email,
  address_line = excluded.address_line,
  baptism_status = excluded.baptism_status,
  baptism_date = excluded.baptism_date,
  marital_status = excluded.marital_status,
  occupation = excluded.occupation,
  status = excluded.status,
  joined_on = excluded.joined_on;

insert into public.department_members (department_id, member_id, is_department_head)
select departments.id, members.id, assignments.is_department_head
from (
  values
    ('Deacons', 'HG-001', false),
    ('Choir', 'HG-002', false),
    ('Youth Ministry', 'HG-003', true),
    ('Sabbath School', 'HG-004', false),
    ('Media Ministry', 'HG-005', false),
    ('Youth Ministry', 'HG-006', false)
) as assignments(department_name, member_number, is_department_head)
join public.departments on departments.name = assignments.department_name
join public.members on members.member_number = assignments.member_number
on conflict (department_id, member_id) do update set is_department_head = excluded.is_department_head;

insert into public.attendance_sessions (
  id, service_name, service_type, service_date, starts_at,
  adult_count, child_count, visitor_count, notes, recorded_by
)
values
  ('d0000000-0000-0000-0000-000000000001', 'Divine Service', 'divine_service', '2026-05-30', '11:00', 238, 42, 18, 'Sabbath worship attendance', 'a0000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000002', 'Sabbath School', 'sabbath_school', '2026-05-30', '09:30', 191, 38, 12, 'Weekly Sabbath School classes', 'a0000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000003', 'Midweek Prayer Meeting', 'midweek_prayer_meeting', '2026-05-27', '19:00', 54, 6, 3, 'Prayer and Bible study', 'a0000000-0000-0000-0000-000000000004'),
  ('d0000000-0000-0000-0000-000000000004', 'Youth Program', 'youth_program', '2026-05-23', '16:00', 72, 19, 9, 'Youth worship program', 'a0000000-0000-0000-0000-000000000005')
on conflict (service_name, service_date) do update set
  service_type = excluded.service_type,
  starts_at = excluded.starts_at,
  adult_count = excluded.adult_count,
  child_count = excluded.child_count,
  visitor_count = excluded.visitor_count,
  notes = excluded.notes,
  recorded_by = excluded.recorded_by;

insert into public.funds (name, contribution_type, description)
values
  ('Tithe', 'tithe', 'Regular tithe contributions'),
  ('Sabbath Offering', 'offering', 'Regular Sabbath worship offering'),
  ('Building Fund', 'building_fund', 'Church building and facilities fund'),
  ('Mission Offering', 'missions', 'Mission and evangelism support'),
  ('Thanksgiving Offering', 'thanksgiving_offering', 'Thanksgiving gifts and offerings'),
  ('Special Donation', 'special_donation', 'Special gifts and designated donations')
on conflict (name) do update set description = excluded.description;

insert into public.contribution_batches (id, batch_date, reference, notes, recorded_by)
values
  ('c0000000-0000-0000-0000-000000000001', '2026-05-30', 'DEMO-2026-05-30', 'Demo Sabbath treasury batch', 'a0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000002', '2026-05-23', 'DEMO-2026-05-23', 'Demo Sabbath treasury batch', 'a0000000-0000-0000-0000-000000000003')
on conflict (reference) do update set notes = excluded.notes, recorded_by = excluded.recorded_by;

insert into public.contributions (
  id, batch_id, member_id, fund_id, amount, contribution_date,
  payment_method, receipt_number, source_name, notes, recorded_by
)
select contributions.id, batches.id, members.id, funds.id,
  contributions.amount, contributions.contribution_date, contributions.payment_method,
  contributions.receipt_number, contributions.source_name, contributions.notes,
  'a0000000-0000-0000-0000-000000000003'
from (
  values
    ('e0000000-0000-0000-0000-000000000001'::uuid, 'DEMO-2026-05-30', 'HG-001', 'Tithe', 3680.00::numeric, '2026-05-30'::date, 'bank_transfer'::public.payment_method, 'HG-DEMO-1051', 'Kwame Mensah', null),
    ('e0000000-0000-0000-0000-000000000002'::uuid, 'DEMO-2026-05-30', null, 'Sabbath Offering', 1240.00::numeric, '2026-05-30'::date, 'cash'::public.payment_method, 'HG-DEMO-1052', 'Congregation', 'Sabbath worship offering'),
    ('e0000000-0000-0000-0000-000000000003'::uuid, 'DEMO-2026-05-23', 'HG-002', 'Tithe', 3150.00::numeric, '2026-05-23'::date, 'bank_transfer'::public.payment_method, 'HG-DEMO-1048', 'Akosua Boateng', null),
    ('e0000000-0000-0000-0000-000000000004'::uuid, 'DEMO-2026-05-23', null, 'Building Fund', 860.00::numeric, '2026-05-23'::date, 'cash'::public.payment_method, 'HG-DEMO-1049', 'Congregation', null),
    ('e0000000-0000-0000-0000-000000000005'::uuid, 'DEMO-2026-05-23', null, 'Mission Offering', 620.00::numeric, '2026-05-23'::date, 'cash'::public.payment_method, 'HG-DEMO-1043', 'Congregation', null),
    ('e0000000-0000-0000-0000-000000000006'::uuid, 'DEMO-2026-05-23', null, 'Special Donation', 540.00::numeric, '2026-05-23'::date, 'bank_transfer'::public.payment_method, 'HG-DEMO-1039', 'Anonymous', 'Youth camp support')
) as contributions(id, batch_reference, member_number, fund_name, amount, contribution_date, payment_method, receipt_number, source_name, notes)
join public.contribution_batches batches on batches.reference = contributions.batch_reference
join public.funds on funds.name = contributions.fund_name
left join public.members on members.member_number = contributions.member_number
on conflict (receipt_number) do update set
  batch_id = excluded.batch_id,
  member_id = excluded.member_id,
  fund_id = excluded.fund_id,
  amount = excluded.amount,
  contribution_date = excluded.contribution_date,
  payment_method = excluded.payment_method,
  source_name = excluded.source_name,
  notes = excluded.notes,
  recorded_by = excluded.recorded_by;

commit;
