-- Enum additions must commit before PostgreSQL allows them in seed records.
alter type public.contribution_type add value if not exists 'thanksgiving_offering';
