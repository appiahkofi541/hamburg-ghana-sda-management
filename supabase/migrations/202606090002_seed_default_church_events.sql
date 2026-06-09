-- Seed default Hamburg Ghana SDA Church events only when the calendar is empty.

insert into public.events (
  title,
  description,
  starts_at,
  ends_at,
  location,
  event_type,
  status,
  recurrence,
  recurrence_until
)
select *
from (
  values
    (
      'Sabbath School & Worship Service',
      'Weekly Sabbath School, divine worship, and fellowship at Hamburg Ghana SDA Church.',
      '2026-06-13 09:30:00+02'::timestamptz,
      '2026-06-13 13:30:00+02'::timestamptz,
      'Hamburg Ghana SDA Church Main Sanctuary',
      'Sabbath Program',
      'published'::public.event_status,
      'weekly'::public.event_recurrence,
      '2026-12-26'::date
    ),
    (
      'Family Sabbath & Fellowship',
      'A special Sabbath focused on family worship, prayer, lunch, and afternoon fellowship.',
      '2026-06-20 09:30:00+02'::timestamptz,
      '2026-06-20 17:00:00+02'::timestamptz,
      'Hamburg Ghana SDA Church Hall',
      'Sabbath Program',
      'published'::public.event_status,
      'none'::public.event_recurrence,
      null::date
    ),
    (
      'Youth Congress Hamburg',
      'Youth worship, Bible study, leadership workshops, music, and community outreach.',
      '2026-07-04 10:00:00+02'::timestamptz,
      '2026-07-05 17:00:00+02'::timestamptz,
      'Hamburg Ghana SDA Church and Hamburg-Mitte',
      'Youth Congress',
      'published'::public.event_status,
      'none'::public.event_recurrence,
      null::date
    ),
    (
      'Camp Meeting',
      'Northern Germany camp meeting weekend with worship, study, prayer, and fellowship.',
      '2026-08-14 16:00:00+02'::timestamptz,
      '2026-08-16 14:00:00+02'::timestamptz,
      'Schleswig-Holstein Retreat Centre',
      'Camp Meeting',
      'published'::public.event_status,
      'yearly'::public.event_recurrence,
      null::date
    ),
    (
      'Evangelism Campaign',
      'Community Bible teaching, health emphasis, prayer, music, and outreach series.',
      '2026-09-12 18:00:00+02'::timestamptz,
      '2026-09-19 20:30:00+02'::timestamptz,
      'Hamburg Ghana SDA Church Hall',
      'Evangelism Campaign',
      'published'::public.event_status,
      'none'::public.event_recurrence,
      null::date
    )
) as seed_events (
  title,
  description,
  starts_at,
  ends_at,
  location,
  event_type,
  status,
  recurrence,
  recurrence_until
)
where not exists (
  select 1
  from public.events
);
