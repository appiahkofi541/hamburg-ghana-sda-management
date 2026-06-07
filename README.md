# Hamburg Ghana SDA Church Management System

Production-ready church management portal for Hamburg Ghana SDA Church in Hamburg, Germany.

Built with Next.js 15, TypeScript, Tailwind CSS, Supabase Auth, PostgreSQL, Supabase Storage, and row-level security.

## Current Modules

- Authentication: login, logout, forgot password, change password, protected routes
- Role-based access: Super Admin, Pastor, Elder, Church Clerk, Secretary, Treasurer, Department Head, Member
- Dashboard with church metrics and member dashboard links
- Member Management with add, edit, delete, search, profile, PDF export, Excel export
- Departments and SDA ministry defaults
- Attendance tracking
- Finance: accounts, member payments, tithe, offerings, reports, receipts, WhatsApp receipt placeholders
- Member Giving Portal and contribution statements
- Events calendar, announcements, reports, settings
- Prayer Request Portal
- Sermon Archive with Supabase Storage support
- Livestream module with YouTube embeds
- WhatsApp Notification module placeholders
- Online Giving module placeholders
- Bilingual UI foundation: English and Deutsch

## Requirements

- Node.js `22.x`
- npm
- Supabase project
- Vercel account
- Supabase CLI, or access to Supabase SQL Editor

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Add Supabase values to `.env.local`.

4. Apply all Supabase migrations in order. See [supabase/README.md](supabase/README.md).

5. Start the local app:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Environment Variables

Use `.env.example` as the template.

Browser-safe variables:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
# Backward-compatible fallback:
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Server-only variables:

```text
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
WHATSAPP_ACCESS_TOKEN=your-whatsapp-token
WHATSAPP_PHONE_NUMBER_ID=your-whatsapp-phone-number-id
WHATSAPP_GRAPH_API_VERSION=v25.0
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
```

Security rule: only variables starting with `NEXT_PUBLIC_` are allowed in browser code. Never prefix service-role, WhatsApp, or Stripe secrets with `NEXT_PUBLIC_`.

`SUPABASE_SERVICE_ROLE_KEY` is required for server-side admin operations such as Invite User and payment webhooks. Add it to `.env.local` locally and to Vercel as a server-only environment variable.

## Supabase Migration Order

Apply every file in [supabase/migrations](supabase/migrations) by filename order. The current order is documented in [supabase/README.md](supabase/README.md).

For CLI deployment:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

For manual SQL Editor deployment, open each migration file in filename order and run it once.

Do not run [supabase/seed.sql](supabase/seed.sql) in production. It is for disposable testing only.

## Super Admin User Setup

1. Create the first user in Supabase Authentication.
2. Confirm the user email.
3. Run this SQL in Supabase SQL Editor:

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'super_admin'::public.app_role
   from auth.users
   where email = 'your-admin-email@example.com'
   on conflict do nothing;
   ```

4. Confirm the profile is active:

   ```sql
   update public.profiles
   set is_active = true
   where email = 'your-admin-email@example.com';
   ```

5. Sign in and verify the user displays as Super Admin.

## Testing Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Login works
- [ ] Logout works
- [ ] Forgot password email and callback work
- [ ] Super Admin can manage users
- [ ] Treasurer can add, edit, delete finance payments
- [ ] Super Admin can manage all finance records
- [ ] Member can view only their own contribution history
- [ ] Member add/edit/delete works for Super Admin, Pastor, Elder, Church Clerk, and Secretary
- [ ] Member role has read-only member access
- [ ] Attendance records can be created and viewed by allowed roles
- [ ] Events and announcements pages load
- [ ] Dashboard totals load from Supabase
- [ ] Mobile sidebar and top navigation work
- [ ] EN/DE language switching works without logout
- [ ] Protected routes redirect unauthenticated users to `/login`

## Vercel Deployment Checklist

- [ ] Create production Supabase project
- [ ] Apply all migrations in order
- [ ] Do not apply demo seed data
- [ ] Create and bootstrap production Super Admin user
- [ ] Import repo into Vercel
- [ ] Confirm framework preset is Next.js
- [ ] Confirm Node.js `22.x`
- [ ] Add all required environment variables
- [ ] Mark secrets as server-only by avoiding `NEXT_PUBLIC_`
- [ ] Deploy
- [ ] Set Supabase Auth Site URL to production domain
- [ ] Add production callback URL:

  ```text
  https://your-domain.example/auth/callback?next=/change-password
  ```

- [ ] Add local callback for development:

  ```text
  http://localhost:3000/auth/callback?next=/change-password
  ```

- [ ] Smoke test production login, dashboard, users, members, finance, and member portal

## Security Checklist

- [ ] Supabase RLS is enabled on application tables
- [ ] Service-role key is never exposed to client code
- [ ] WhatsApp and Stripe secrets are server-only
- [ ] Demo seed users are not present in production
- [ ] First Super Admin uses a strong password
- [ ] Treasurer permissions are limited to finance management
- [ ] Super Admin has full-system access
- [ ] Member RLS limits contribution history to the logged-in member
- [ ] Supabase Auth redirect URLs are restricted to approved domains
- [ ] Vercel deployment logs contain no secret values
- [ ] Supabase logs are reviewed after production smoke test

## Quality Commands

Run before every deployment:

```bash
npm run typecheck
npm run lint
npm run build
```
