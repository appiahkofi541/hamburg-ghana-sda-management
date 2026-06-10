-- Add meeting day support for Baptism Classes.

alter table public.baptism_classes
  add column if not exists meeting_day text;

create index if not exists baptism_classes_meeting_day_idx
on public.baptism_classes (meeting_day);
