-- Complete the first five core modules with SDA defaults and validation-ready fields.
alter table public.members
  add column baptism_status boolean not null default false;

create type public.attendance_service as enum (
  'sabbath_school',
  'divine_service',
  'midweek_prayer_meeting',
  'youth_program',
  'special_event'
);

alter table public.attendance_sessions
  add column service_type public.attendance_service not null default 'divine_service';

insert into public.departments (name, description)
values
  ('Elders', 'Spiritual leadership and pastoral support'),
  ('Deacons', 'Church service, hospitality, and practical support'),
  ('Deaconesses', 'Member care, hospitality, and church support'),
  ('Treasury', 'Financial stewardship and reporting'),
  ('Secretariat', 'Church records and administration'),
  ('Sabbath School', 'Bible study and Sabbath School coordination'),
  ('Youth Ministry', 'Programs and discipleship for youth and young adults'),
  ('Women''s Ministry', 'Ministry and fellowship for women'),
  ('Men''s Ministry', 'Ministry and fellowship for men'),
  ('Pathfinder Club', 'Youth development and Pathfinder activities'),
  ('Adventurer Club', 'Faith-based activities for younger children'),
  ('Choir', 'Worship music and choir ministry'),
  ('Media Ministry', 'Audio, visual, streaming, and communications support'),
  ('Children''s Ministry', 'Programs and spiritual support for children'),
  ('Personal Ministries', 'Evangelism, outreach, and personal ministry')
on conflict (name) do nothing;

insert into public.funds (name, contribution_type, description)
values
  ('Sabbath Offering', 'offering', 'Regular Sabbath worship offering'),
  ('Mission Offering', 'missions', 'Mission and evangelism support'),
  ('Special Donation', 'special_donation', 'Special gifts and designated donations')
on conflict (name) do nothing;

grant usage on type public.attendance_service to authenticated;
