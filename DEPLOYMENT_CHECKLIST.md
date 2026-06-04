# Vercel Deployment Checklist

Use this checklist for the Hamburg Ghana SDA Church Management System
production release.

## Before Deployment

- [ ] Create a production Supabase project.
- [ ] Apply every SQL migration in `supabase/migrations` in order.
- [ ] Do not apply `supabase/seed.sql` to production.
- [ ] Create the first production Supabase Auth user.
- [ ] Assign the first user the `admin` role using the bootstrap query in
      `supabase/README.md`.
- [ ] Confirm row-level security is enabled on church data tables.
- [ ] Run `npm install`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.

## Vercel Project

- [ ] Import the repository into Vercel.
- [ ] Confirm the framework preset is **Next.js**.
- [ ] Confirm Node.js `22.x` is selected from `package.json`.
- [ ] Add `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` as a server-only variable for Invite User and webhooks.
- [ ] Add WhatsApp variables only if WhatsApp delivery is ready.
- [ ] Add Stripe variables only if Online Giving checkout is ready.
- [ ] Add variables to Production, Preview, and Development environments.
- [ ] Deploy the application.

## Supabase Auth URLs

- [ ] Set the Supabase Auth Site URL to the production domain.
- [ ] Add the production password reset callback:
      `https://your-domain.example/auth/callback?next=/change-password`
- [ ] Add the Vercel preview callback when preview authentication is required.
- [ ] Keep the local callback for development:
      `http://localhost:3000/auth/callback?next=/change-password`

## Smoke Test

- [ ] Open the production `/login` page.
- [ ] Sign in as an Admin.
- [ ] Confirm Dashboard totals load from Supabase.
- [ ] Add, edit, and delete a temporary member.
- [ ] Add, edit, and delete a temporary attendance record.
- [ ] Record and verify a temporary finance payment as Treasurer.
- [ ] Confirm the payment appears in the member's giving history.
- [ ] Confirm the finance account balance updates.
- [ ] Generate and print a finance receipt.
- [ ] Confirm Admin can view finance records and reports but cannot add, edit, or delete.
- [ ] Confirm Pastor, Elder, Secretary, Department Head, and Member cannot access the Finance Module.
- [ ] Confirm Department Head can edit only the assigned department.
- [ ] Confirm Member cannot access restricted pages.
- [ ] Confirm Member can view only their own contribution history.
- [ ] Switch language between EN and DE without being logged out.
- [ ] Request a password reset and verify the callback opens `/change-password`.
- [ ] Log out and confirm protected routes return to `/login`.
- [ ] Check the layout on desktop and mobile widths.

## Security

- [ ] Never expose the Supabase service-role key in Vercel client variables.
- [ ] Never expose WhatsApp or Stripe secrets through `NEXT_PUBLIC_` variables.
- [ ] Remove demo accounts from production.
- [ ] Use unique passwords for production users.
- [ ] Confirm Supabase Auth redirect URLs only include approved local, preview, and production domains.
- [ ] Review Supabase logs after the smoke test.
- [ ] Review Vercel deployment logs for build or runtime errors.
