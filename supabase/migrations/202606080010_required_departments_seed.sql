-- Ensure required Hamburg Ghana SDA Church departments exist.

insert into public.departments (name, description, is_active)
values
  ('Sabbath School', 'Bible study, lesson coordination, and Sabbath School ministry.', true),
  ('Youth Ministry', 'Youth discipleship, programs, and young adult ministry.', true),
  ('Women''s Ministry', 'Women''s fellowship, discipleship, and ministry coordination.', true),
  ('Men''s Ministry', 'Men''s fellowship, discipleship, and ministry coordination.', true),
  ('Children''s Ministry', 'Children''s Sabbath programs, care, and discipleship.', true),
  ('Music Ministry', 'Music coordination, worship support, and special music ministry.', true),
  ('Health & Temperance', 'Health, temperance, wellness, and lifestyle ministry coordination.', true),
  ('Singing Band', 'Singing band ministry, rehearsals, and music support.', true),
  ('Welfare', 'Member care, welfare support, and community assistance.', true),
  ('Treasury', 'Church treasury, finance records, and stewardship support.', true),
  ('Secretariat', 'Church records, minutes, correspondence, and administration.', true),
  ('Evangelism', 'Outreach, evangelistic programs, and mission coordination.', true)
on conflict (name) do update
set
  description = coalesce(public.departments.description, excluded.description),
  is_active = true,
  updated_at = now();
