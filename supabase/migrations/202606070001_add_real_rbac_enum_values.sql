-- PostgreSQL-safe enum expansion.
-- Run this migration first and let it commit before running the RBAC policy
-- migration. PostgreSQL does not allow newly added enum values to be used in
-- the same transaction that creates them.

alter type public.app_role add value if not exists 'super_admin';
alter type public.app_role add value if not exists 'church_clerk';
