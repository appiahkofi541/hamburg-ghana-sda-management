# Database Backup and Deployment Readiness Checklist

Use this document before deploying the Hamburg Ghana SDA Church Management System to production or before making major database changes.

## 1. Supabase Migration Inventory

Apply migrations in filename order. Confirm every item has run successfully in the target Supabase project.

- [ ] `202605310001_extensions_and_types.sql`
- [ ] `202605310002_users_and_roles.sql`
- [ ] `202605310003_departments_and_members.sql`
- [ ] `202605310004_attendance.sql`
- [ ] `202605310005_tithe_and_offerings.sql`
- [ ] `202605310006_events_and_announcements.sql`
- [ ] `202605310007_triggers_indexes_and_seed_data.sql`
- [ ] `202605310008_row_level_security.sql`
- [ ] `202605310009_api_permissions.sql`
- [ ] `202605310010_member_management_fields.sql`
- [ ] `202605310011_special_donations.sql`
- [ ] `202605310012_calendar_recurring_events.sql`
- [ ] `202605310013_core_modules_completion.sql`
- [ ] `202605310014_thanksgiving_offering_enum.sql`
- [ ] `202605310015_finance_fund_cleanup.sql`
- [ ] `202605310016_department_head_permissions.sql`
- [ ] `202605310017_finance_source_name.sql`
- [ ] `202605310018_elder_department_memberships.sql`
- [ ] `202605310019_department_head_least_privilege.sql`
- [ ] `202606020020_prayer_request_portal.sql`
- [ ] `202606020021_sermon_archive.sql`
- [ ] `202606020022_livestream_module.sql`
- [ ] `202606020023_whatsapp_notifications.sql`
- [ ] `202606020024_whatsapp_contact_privacy.sql`
- [ ] `202606020025_online_giving.sql`
- [ ] `202606020026_online_giving_pending_cleanup.sql`
- [ ] `202606020027_normalize_user_roles.sql`
- [ ] `202606020028_user_access_management.sql`
- [ ] `202606020029_user_profiles_view.sql`
- [ ] `202606020030_user_profiles_view_privacy.sql`
- [ ] `202606020031_member_management_permissions.sql`
- [ ] `202606030001_finance_accounting_system.sql`
- [ ] `202606030002_finance_whatsapp_payment_notifications.sql`
- [ ] `202606030003_member_giving_portal_rls.sql`
- [ ] `202606030004_finance_payment_permissions.sql`
- [ ] `202606030005_language_preference.sql`
- [ ] `202606030006_finance_payment_member_workflow.sql`
- [ ] `202606040001_member_profile_photos.sql`
- [ ] `202606040002_member_photo_storage_policies.sql`

Recommended migration command:

```bash
supabase db push
```

Manual fallback: run each SQL file from `supabase/migrations` in Supabase SQL Editor, oldest to newest.

## 2. Database Backup Checklist

Create a backup before migration, deployment, or production data changes.

- [ ] Confirm the target Supabase project reference.
- [ ] Confirm you are backing up production, not a preview/test project.
- [ ] Export schema.
- [ ] Export data.
- [ ] Export storage objects or confirm storage backups are enabled.
- [ ] Store backup files in a secure, access-controlled location.
- [ ] Record backup date, operator, and Supabase project ref.

Supabase CLI examples:

```bash
supabase db dump --linked --schema public > backups/schema-public.sql
supabase db dump --linked --data-only > backups/data.sql
```

If CLI backup is unavailable, use Supabase Dashboard database backups or SQL export tools.

Critical tables to verify in backup:

- `profiles`
- `user_roles`
- `members`
- `departments`
- `department_members`
- `attendance_sessions`
- `attendance_entries`
- `finance_accounts`
- `finance_transactions`
- `finance_categories`
- `bank_accounts`
- `cash_accounts`
- `events`
- `announcements`
- `prayer_requests`
- `prayer_testimonies`
- `sermons`
- `livestreams`
- `whatsapp_contacts`
- `whatsapp_campaigns`
- `whatsapp_deliveries`
- `whatsapp_payment_settings`
- `whatsapp_payment_notification_logs`
- `online_giving_payments`
- `payment_webhook_events`

## 3. Storage Bucket Inventory

Confirm these Supabase Storage buckets exist and policies match the migrations.

| Bucket | Purpose | Public | Notes |
| --- | --- | --- | --- |
| `sermon-media` | Sermon video/audio/PDF resources and Sabbath School lessons | Yes | Created by sermon archive migration. |
| `member-photos` | Member profile photos and generated thumbnails | Yes | Allows JPG, JPEG, PNG, WEBP. Bucket should match the current production size limit. Paths use `<member_id>/<filename>`. |

Storage readiness checks:

- [ ] `member-photos` exists.
- [ ] `member-photos` is public.
- [ ] `member-photos` policies do not require a `private` folder.
- [ ] Member photo paths are stored as `<member_id>/<filename>`.
- [ ] Admin and Secretary can manage member photos.
- [ ] Members can manage only their own photo folder.
- [ ] Pastor and Elder can view photos but cannot manage them.
- [ ] `sermon-media` exists for sermon resources.
- [ ] Sermon upload policies allow only Admin, Pastor, and Secretary to manage media.

## 4. Environment Variables Inventory

Set these locally in `.env.local` and in Vercel Project Settings.

Browser-safe variables:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only variables:

- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `WHATSAPP_ACCESS_TOKEN`
- [ ] `WHATSAPP_PHONE_NUMBER_ID`
- [ ] `WHATSAPP_GRAPH_API_VERSION`
- [ ] `STRIPE_SECRET_KEY`
- [ ] `STRIPE_WEBHOOK_SECRET`

Optional WhatsApp payment template variables used by server code:

- [ ] `WHATSAPP_PAYMENT_TEMPLATE_NAME`
- [ ] `WHATSAPP_TEMPLATE_LANGUAGE`
- [ ] `WHATSAPP_PAYMENT_AUTO_NOTIFICATIONS`
- [ ] `WHATSAPP_GRAPH_API_BASE_URL`

Environment security checks:

- [ ] Only Supabase URL and anon key use `NEXT_PUBLIC_`.
- [ ] Service-role key is server-only.
- [ ] Stripe secrets are server-only.
- [ ] WhatsApp tokens are server-only.
- [ ] No real secrets are committed to the repository.
- [ ] Vercel variables are configured for Production.
- [ ] Preview variables are configured only if preview authentication/testing is required.

## 5. User Roles Inventory

Application roles:

| Role | Label | Production Purpose |
| --- | --- | --- |
| `admin` | Admin | Full system administration and user management. Finance is view-only. |
| `pastor` | Pastor | Ministry oversight, pastoral modules, member visibility, reports. |
| `elder` | Elder | Member, department, attendance, and report visibility. |
| `treasurer` | Treasurer | Full finance account and payment management. |
| `secretary` | Secretary | Member records, departments, attendance, media, communications, member photos. |
| `department_head` | Department Head | Assigned department and ministry attendance workflows. |
| `member` | Member | Own profile, own attendance, own contributions, prayer requests, events, announcements, sermons. |

Role readiness checks:

- [ ] First production Admin is created in Supabase Auth.
- [ ] First production Admin has `admin` in `public.user_roles`.
- [ ] Elevated users do not retain duplicate baseline `member` role unless intentionally needed.
- [ ] Treasurer account exists for finance operations.
- [ ] Secretary account exists for member administration.
- [ ] Test Member account is linked to a `members.profile_id`.
- [ ] Deactivated users have `profiles.is_active = false`.

First Admin bootstrap:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where email = 'your-admin-email@example.com'
on conflict do nothing;

update public.profiles
set is_active = true
where email = 'your-admin-email@example.com';
```

## 6. Deployment Checklist

Pre-deployment:

- [ ] Create database backup.
- [ ] Confirm all migrations are applied.
- [ ] Confirm Storage buckets and policies.
- [ ] Confirm environment variables.
- [ ] Confirm first Admin can log in.
- [ ] Confirm no demo seed users exist in production.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.

Vercel deployment:

- [ ] Import repository into Vercel.
- [ ] Confirm Framework Preset is Next.js.
- [ ] Confirm Node.js version is `22.x`.
- [ ] Add browser-safe environment variables.
- [ ] Add server-only environment variables.
- [ ] Deploy production build.
- [ ] Review Vercel build logs.
- [ ] Set Supabase Auth Site URL to production domain.
- [ ] Add Supabase Auth callback URL:

```text
https://your-domain.example/auth/callback?next=/change-password
```

Post-deployment smoke test:

- [ ] Open `/login`.
- [ ] Login as Admin.
- [ ] Confirm Admin role displays correctly.
- [ ] Confirm Dashboard totals load.
- [ ] Confirm Members page loads.
- [ ] Add/edit/delete a temporary member.
- [ ] Upload and view a member profile photo.
- [ ] Confirm Attendance page loads and photo roster appears.
- [ ] Login as Treasurer and record a test payment.
- [ ] Confirm member contribution history updates.
- [ ] Confirm receipt generation works.
- [ ] Confirm Admin can view finance but cannot edit/delete.
- [ ] Confirm Member can view only own contributions.
- [ ] Test EN/DE language switch.
- [ ] Test forgot password callback.
- [ ] Logout and confirm protected routes redirect to login.

## 7. Security Checklist

Database and RLS:

- [ ] RLS is enabled on all application tables.
- [ ] `public.has_role` and `public.has_any_role` helpers exist.
- [ ] Finance write policies allow Treasurer only.
- [ ] Finance read policies allow Admin and Treasurer.
- [ ] Member contribution policies restrict Members to own records.
- [ ] User management APIs require active Admin.
- [ ] Storage policies for `member-photos` do not allow arbitrary authenticated writes.

Storage:

- [ ] `member-photos` blocks `private/...` paths.
- [ ] `member-photos` allows only member-id folder paths.
- [ ] `member-photos` allows only approved image MIME types.
- [ ] Profile photo size limit matches app validation and bucket configuration.
- [ ] `sermon-media` upload access is limited to authorized media managers.

Secrets:

- [ ] No service-role key in client components.
- [ ] No WhatsApp token in client components.
- [ ] No Stripe secret in client components.
- [ ] No secrets in git history or documentation examples.

Operational:

- [ ] Production users have strong passwords.
- [ ] Demo users removed from production.
- [ ] Supabase Auth redirects restricted to approved domains.
- [ ] Vercel logs reviewed after deployment.
- [ ] Supabase Auth, Database, Storage, and Edge/API logs reviewed after smoke test.
- [ ] Backup restore procedure is known before launch.
