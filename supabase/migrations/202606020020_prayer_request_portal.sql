create type public.prayer_request_status as enum (
  'submitted',
  'praying',
  'answered',
  'archived'
);

create type public.testimony_status as enum (
  'pending',
  'published',
  'archived'
);

create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null,
  request_text text not null,
  is_public boolean not null default false,
  status public.prayer_request_status not null default 'submitted',
  pastor_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prayer_testimonies (
  id uuid primary key default gen_random_uuid(),
  prayer_request_id uuid references public.prayer_requests(id) on delete set null,
  submitted_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null,
  testimony_text text not null,
  is_public boolean not null default true,
  status public.testimony_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_prayer_requests_updated_at before update on public.prayer_requests
  for each row execute procedure public.set_updated_at();
create trigger set_prayer_testimonies_updated_at before update on public.prayer_testimonies
  for each row execute procedure public.set_updated_at();

create index prayer_requests_submitted_by_idx on public.prayer_requests (submitted_by);
create index prayer_requests_status_created_at_idx on public.prayer_requests (status, created_at desc);
create index prayer_testimonies_submitted_by_idx on public.prayer_testimonies (submitted_by);
create index prayer_testimonies_request_id_idx on public.prayer_testimonies (prayer_request_id);

alter table public.prayer_requests enable row level security;
alter table public.prayer_testimonies enable row level security;

create policy "Church can view public and own prayer requests"
  on public.prayer_requests for select to authenticated
  using (
    is_public
    or submitted_by = auth.uid()
    or public.has_any_role(array['admin', 'pastor']::public.app_role[])
  );

create policy "Users can submit prayer requests"
  on public.prayer_requests for insert to authenticated
  with check (submitted_by = auth.uid());

create policy "Pastoral team can manage prayer requests"
  on public.prayer_requests for update to authenticated
  using (public.has_any_role(array['admin', 'pastor']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor']::public.app_role[]));

create policy "Church can view published and own testimonies"
  on public.prayer_testimonies for select to authenticated
  using (
    (is_public and status = 'published')
    or submitted_by = auth.uid()
    or public.has_any_role(array['admin', 'pastor']::public.app_role[])
  );

create policy "Users can submit testimonies"
  on public.prayer_testimonies for insert to authenticated
  with check (submitted_by = auth.uid() and status = 'pending');

create policy "Pastoral team can manage testimonies"
  on public.prayer_testimonies for update to authenticated
  using (public.has_any_role(array['admin', 'pastor']::public.app_role[]))
  with check (public.has_any_role(array['admin', 'pastor']::public.app_role[]));

grant usage on type public.prayer_request_status to authenticated;
grant usage on type public.testimony_status to authenticated;
grant select, insert, update on table public.prayer_requests to authenticated;
grant select, insert, update on table public.prayer_testimonies to authenticated;
