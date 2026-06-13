begin;

-- Ministry groups are not required by the current Department Management flow.
-- Keep this migration safe for projects where public.record_settings has not
-- been installed.

commit;
