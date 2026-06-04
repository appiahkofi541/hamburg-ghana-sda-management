create type public.sermon_media_type as enum (
  'video',
  'audio',
  'pdf',
  'sabbath_school_lesson'
);

create type public.sermon_status as enum (
  'draft',
  'published',
  'archived'
);

create table public.sermon_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table public.sermons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  speaker text,
  sermon_date date not null default current_date,
  media_type public.sermon_media_type not null,
  category_id uuid references public.sermon_categories(id) on delete set null,
  media_url text not null,
  storage_path text,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  status public.sermon_status not null default 'published',
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sermons_set_updated_at
before update on public.sermons
for each row execute function public.set_updated_at();

create index sermons_sermon_date_idx on public.sermons (sermon_date desc);
create index sermons_media_type_idx on public.sermons (media_type);
create index sermons_category_id_idx on public.sermons (category_id);
create index sermons_title_search_idx on public.sermons (lower(title));

alter table public.sermon_categories enable row level security;
alter table public.sermons enable row level security;

create policy "Authenticated users can view sermon categories"
on public.sermon_categories for select to authenticated using (true);

create policy "Ministry team can create sermon categories"
on public.sermon_categories for insert to authenticated
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Ministry team can update sermon categories"
on public.sermon_categories for update to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Ministry team can delete sermon categories"
on public.sermon_categories for delete to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Authenticated users can view published sermons"
on public.sermons for select to authenticated
using (status = 'published' or public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Ministry team can create sermons"
on public.sermons for insert to authenticated
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Ministry team can update sermons"
on public.sermons for update to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
with check (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Ministry team can delete sermons"
on public.sermons for delete to authenticated
using (public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

grant usage on type public.sermon_media_type, public.sermon_status to authenticated;
grant select, insert, update, delete on public.sermon_categories to authenticated;
grant select, insert, update, delete on public.sermons to authenticated;

insert into public.sermon_categories (name, description) values
  ('Worship Service', 'Sabbath worship messages and special services.'),
  ('Sabbath School', 'Bible study lessons and Sabbath School resources.'),
  ('Evangelism', 'Campaign sermons and outreach messages.'),
  ('Youth Ministry', 'Messages and studies for young people.'),
  ('Family Life', 'Sermons and studies for healthy Christian homes.')
on conflict (name) do nothing;

insert into storage.buckets (id, name, public)
values ('sermon-media', 'sermon-media', true)
on conflict (id) do update set public = excluded.public;

create policy "Authenticated users can view sermon media"
on storage.objects for select to authenticated using (bucket_id = 'sermon-media');

create policy "Ministry team can upload sermon media"
on storage.objects for insert to authenticated
with check (bucket_id = 'sermon-media' and public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Ministry team can update sermon media"
on storage.objects for update to authenticated
using (bucket_id = 'sermon-media' and public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]))
with check (bucket_id = 'sermon-media' and public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));

create policy "Ministry team can delete sermon media"
on storage.objects for delete to authenticated
using (bucket_id = 'sermon-media' and public.has_any_role(array['admin', 'pastor', 'secretary']::public.app_role[]));
