# Supabase Database Schema

Apply the ordered migrations with the Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

For production, create a separate Supabase project and do not apply
`supabase/seed.sql`. Copy the project URL and anonymous key from **Supabase
Dashboard -> Project Settings -> API** into the matching Vercel environment
variables:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Configure password reset callbacks in **Supabase Dashboard -> Authentication
-> URL Configuration**:

```text
http://localhost:3000/auth/callback?next=/change-password
https://your-production-domain.example/auth/callback?next=/change-password
```

## Migration order

1. `202605310001_extensions_and_types.sql`
2. `202605310002_users_and_roles.sql`
3. `202605310003_departments_and_members.sql`
4. `202605310004_attendance.sql`
5. `202605310005_tithe_and_offerings.sql`
6. `202605310006_events_and_announcements.sql`
7. `202605310007_triggers_indexes_and_seed_data.sql`
8. `202605310008_row_level_security.sql`
9. `202605310009_api_permissions.sql`
10. `202605310010_member_management_fields.sql`
11. `202605310011_special_donations.sql`
12. `202605310012_calendar_recurring_events.sql`
13. `202605310013_core_modules_completion.sql`
14. `202605310014_thanksgiving_offering_enum.sql`
15. `202605310015_finance_fund_cleanup.sql`
16. `202605310016_department_head_permissions.sql`
17. `202605310017_finance_source_name.sql`
18. `202605310018_elder_department_memberships.sql`
19. `202605310019_department_head_least_privilege.sql`
20. `202606020020_prayer_request_portal.sql`
21. `202606020021_sermon_archive.sql`
22. `202606020022_livestream_module.sql`
23. `202606020023_whatsapp_notifications.sql`
24. `202606020024_whatsapp_contact_privacy.sql`
25. `202606020025_online_giving.sql`
26. `202606020026_online_giving_pending_cleanup.sql`
27. `202606020027_normalize_user_roles.sql`
28. `202606020028_user_access_management.sql`
29. `202606020029_user_profiles_view.sql`
30. `202606020030_user_profiles_view_privacy.sql`
31. `202606020031_member_management_permissions.sql`
32. `202606030001_finance_accounting_system.sql`
33. `202606030002_finance_whatsapp_payment_notifications.sql`
34. `202606030003_member_giving_portal_rls.sql`
35. `202606030004_finance_payment_permissions.sql`
36. `202606030005_language_preference.sql`
37. `202606030006_finance_payment_member_workflow.sql`
38. `202606040001_member_profile_photos.sql`
39. `202606040002_member_photo_storage_policies.sql`
40. `202606070001_real_user_roles_permissions.sql`

## Main tables

- `profiles`, `user_roles`
- `user_profiles` view for access-management integrations
- `user_access_audit`
- `members`, `departments`, `department_members`
- `attendance_sessions`, `attendance_entries`
- `funds`, `contribution_batches`, `contributions`
- `events`, `announcements`
- `prayer_requests`, `prayer_testimonies`
- `sermon_categories`, `sermons`, and the public `sermon-media` Storage bucket
- `livestream_settings`, `livestreams`
- `whatsapp_contacts`, `whatsapp_campaigns`, `whatsapp_deliveries`
- `online_giving_payments`, `payment_webhook_events`
- `finance_accounts`, `finance_transactions`, `finance_categories`
- `bank_accounts`, `cash_accounts`, `income_expenditure_reports`
- `whatsapp_payment_settings`, `whatsapp_payment_notification_logs`

New Supabase Auth users receive a matching `profiles` row and the default
`member` role. Assign additional roles in `user_roles` through an admin-only
server action or the Supabase dashboard. Assigning an elevated role removes
the default `member` row automatically.

Bootstrap the first administrator once from the Supabase SQL editor after
creating the Auth user:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email = 'your-admin-email@example.com'
on conflict do nothing;
```

Then confirm the profile is active:

```sql
update public.profiles
set is_active = true
where email = 'your-admin-email@example.com';
```

## Demo seed data

For a dedicated test project, apply `supabase/seed.sql` after all migrations.
The seed is idempotent and adds demo users, departments, members, attendance
sessions, contribution batches, and tithe/offering records.

All demo users share the password `DemoPass123!`:

| Role | Email |
| --- | --- |
| Super Admin | `admin@hamburgghanasda.demo` |
| Pastor | `pastor@hamburgghanasda.demo` |
| Treasurer | `treasurer@hamburgghanasda.demo` |
| Church Clerk | `secretary@hamburgghanasda.demo` |
| Department Head | `departmenthead@hamburgghanasda.demo` |
| Member | `member@hamburgghanasda.demo` |

The seed writes confirmed users directly to the Supabase Auth schema. Use it
only in local development or a disposable test project, never in production.
