# Vercel Deployment Readiness Guide

Use this guide to deploy the Hamburg Ghana SDA Church Management System to Vercel with a production Supabase project.

## 1. Production Deployment Checklist

- [ ] Create or confirm the production Supabase project.
- [ ] Back up the current database before applying new migrations.
- [ ] Apply every migration in filename order.
- [ ] Confirm required Storage buckets exist.
- [ ] Configure all required Vercel environment variables.
- [ ] Create and bootstrap the first Admin account.
- [ ] Confirm Supabase Auth redirect URLs.
- [ ] Run local production checks:

```bash
npm run typecheck
npm run lint
npm run build
```

- [ ] Import the repository into Vercel.
- [ ] Confirm Framework Preset is `Next.js`.
- [ ] Confirm Node.js version is `22.x`.
- [ ] Deploy to Vercel.
- [ ] Review Vercel build logs.
- [ ] Smoke-test production login, dashboard, members, attendance, finance, member portal, storage uploads, and logout.

## 2. Required Environment Variables

Add these to Vercel Project Settings. Use Production values for the Production environment.

Browser-safe:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Server-only:

```text
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

WhatsApp, only when sending is ready:

```text
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-whatsapp-phone-number-id
WHATSAPP_GRAPH_API_VERSION=v25.0
WHATSAPP_PAYMENT_TEMPLATE_NAME=payment_receipt
WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_PAYMENT_AUTO_NOTIFICATIONS=false
WHATSAPP_GRAPH_API_BASE_URL=https://graph.facebook.com
```

Stripe, only when online giving checkout is ready:

```text
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

Rules:

- [ ] Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public.
- [ ] Never prefix service-role, WhatsApp, or Stripe secrets with `NEXT_PUBLIC_`.
- [ ] Restart local preview after changing `.env.local`.
- [ ] Redeploy Vercel after changing Production environment variables.

## 3. Supabase Production Setup Guide

1. Create a new Supabase project for production.
2. Copy the project URL and anon key into Vercel.
3. Add the service-role key to Vercel as server-only.
4. Apply migrations with Supabase CLI:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

Manual fallback: run every file in `supabase/migrations` in filename order using Supabase SQL Editor.

5. Configure Supabase Auth URLs:

```text
Site URL:
https://your-production-domain.example

Redirect URLs:
https://your-production-domain.example/auth/callback?next=/change-password
http://localhost:3000/auth/callback?next=/change-password
```

6. Do not run `supabase/seed.sql` in production.
7. Confirm RLS is enabled on application tables.
8. Confirm Storage policies are applied.

## 4. Storage Bucket Checklist

Required buckets:

| Bucket | Purpose | Public | Required Policies |
| --- | --- | --- | --- |
| `member-photos` | Member profile photos and thumbnails | Yes | Authenticated users can view. Admin/Secretary manage all. Members manage own member-id folder. |
| `sermon-media` | Sermon media and PDF resources | Yes | Admin/Pastor/Secretary manage media. Authenticated users can view published resources. |

Checks:

- [ ] `member-photos` exists.
- [ ] `member-photos` is public.
- [ ] `member-photos` does not require a `private` folder.
- [ ] Member photo paths use `<member_id>/<filename>`.
- [ ] `member-photos` MIME types allow JPG, JPEG, PNG, WEBP.
- [ ] `member-photos` file size limit matches app validation.
- [ ] `sermon-media` exists.
- [ ] Upload and retrieval test passes for both buckets before launch.

## 5. Migration Order Checklist

Apply in this exact order:

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

## 6. Admin Account Setup Guide

1. Create the Admin user in Supabase Auth.
2. Confirm the email.
3. Run:

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

4. Sign in at `/login`.
5. Confirm the sidebar and dashboard display `Admin`.
6. Confirm Admin can manage users.
7. Confirm Admin can view finance but cannot add, edit, or delete finance records.

## 7. Security Checklist

Access control:

- [ ] Admin can manage users.
- [ ] Treasurer can manage finance records.
- [ ] Admin is finance view-only.
- [ ] Member can view only own contribution history.
- [ ] Secretary can manage member records and member photos.
- [ ] Pastor and Elder can view member photos but cannot manage them.

RLS and Storage:

- [ ] RLS is enabled on application tables.
- [ ] `public.has_role` and `public.has_any_role` exist.
- [ ] `member-photos` policies prevent arbitrary authenticated writes.
- [ ] `member-photos` blocks invalid folder paths.
- [ ] Storage buckets do not expose private credentials.

Secrets:

- [ ] Service-role key is server-only.
- [ ] Stripe secrets are server-only.
- [ ] WhatsApp tokens are server-only.
- [ ] No secrets appear in logs, documentation, screenshots, or committed files.

Launch hygiene:

- [ ] Demo seed data is not applied to production.
- [ ] Production Admin uses a strong password.
- [ ] Supabase Auth redirects are restricted to approved domains.
- [ ] Vercel build logs are reviewed.
- [ ] Supabase Auth, Database, and Storage logs are reviewed after smoke testing.

## 8. Outside-Localhost Verification

Before deploying, verify the app responds on an address other than `localhost`:

```bash
npm run build
npm run start
```

Then test:

```text
http://127.0.0.1:3000/login
```

Expected result: HTTP `200` for `/login`.

After Vercel deployment, test:

```text
https://your-vercel-domain.vercel.app/login
```

Expected result: login page loads, Supabase Auth works, and protected pages redirect correctly.
