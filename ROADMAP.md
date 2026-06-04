# Hamburg Ghana SDA Church Management System Roadmap

Technical expansion plan for Hamburg Ghana SDA Church, Hamburg, Germany.

## 1. Current MVP Features

The current responsive Next.js portal provides:

- Supabase-ready email and password login with a local demo fallback
- Role model for Admin, Pastor, Elder, Treasurer, Secretary, Department Head, and Member
- Dashboard with member, attendance, offering, and upcoming event summaries
- Members management
- Departments and ministry leadership
- Attendance sessions and member or visitor check-ins
- Tithe and offerings with configurable funds and treasury batches
- Events calendar
- Announcements
- User and role management
- Reports and settings placeholders
- Advanced Modules roadmap page
- Prayer request portal with pastoral review
- Sermon archive with searchable categories, Supabase Storage uploads, and resource downloads
- Livestream page with YouTube embeds, scheduling, and recent sermon links
- WhatsApp Business Cloud API campaigns with consent tracking and delivery logs
- Online giving with Stripe Checkout, automatic receipts, and treasury reconciliation

The PostgreSQL migrations already include profiles, roles, members,
departments, attendance, contributions, funds, events, announcements,
timestamps, indexes, and row-level security policies.

## 2. Advanced Modules

| Module | Purpose | Initial Scope |
| --- | --- | --- |
| Mobile App | Give members mobile access to updates, events, giving, and ministry resources. | Member login, announcements, event list, giving links, and profile. |
| SMS Notifications | Send service reminders and urgent church updates. | Admin message composer, recipient groups, delivery log, and opt-out handling. |
| WhatsApp Notifications | Delivered: share approved updates through WhatsApp. | Approved templates, opt-in contacts, announcement broadcasts, event reminders, birthday messages, prayer updates, and delivery status. |
| Online Tithe Payment | Delivered for Europe: accept secure digital tithe and offerings. | Stripe Checkout, fund selection, automatic receipts, signed webhooks, and treasury reconciliation. |
| Livestream Integration | Delivered: make Sabbath services available remotely. | YouTube channel link, current stream embed, upcoming broadcasts, and recent sermon links. |
| Sermon Archive | Delivered: provide a searchable media library. | Sermon metadata, speaker, date, category, external links, audio, video, or document uploads, and resource downloads. |
| Prayer Request Portal | Delivered: members submit public or private prayer needs and testimonies. | Supabase RLS privacy, pastoral status dashboard, and testimony review. |
| Church Voting System | Support controlled member voting. | Eligibility rules, ballots, voting window, anonymous vote option, and results report. |

## 3. Recommended Technologies

| Area | Recommended Technology | Notes |
| --- | --- | --- |
| Web application | Next.js 15, TypeScript, Tailwind CSS, Shadcn UI | Continue the current application stack. |
| Database and authentication | Supabase Auth, PostgreSQL, Row-Level Security | Keep authorization rules enforced in the database. |
| Mobile app | React Native with Expo | Expo is recommended for faster delivery, notifications, and managed builds. |
| SMS | Twilio SMS API | Use verified sender IDs where supported and maintain opt-out records. |
| WhatsApp | WhatsApp Business Cloud API | Use approved templates and explicit member consent. |
| Europe online payments | Stripe Checkout and Stripe webhooks | Recommended for EUR payments and European payment methods. |
| Ghana online payments | Paystack or Flutterwave | Add as regional providers for Ghana support, including local payment methods where available. |
| Livestream | YouTube embed integration | Store the YouTube video or stream URL and embed it in events and the member portal. |
| Sermon files | Supabase Storage | Use private buckets for restricted files and signed URLs when needed. |
| Background jobs | Supabase Edge Functions and scheduled jobs | Handle webhooks, notifications, and reconciliation outside the browser. |
| Observability | Supabase logs with Sentry | Track failures without exposing member or payment details. |

## 4. Database Tables Needed Later

Add future migrations only when each module enters development.

| Module | Suggested Tables |
| --- | --- |
| Mobile App | `push_devices`, `notification_preferences`, `app_sessions` |
| SMS Notifications | `message_campaigns`, `message_recipients`, `message_deliveries`, `communication_consents` |
| WhatsApp Notifications | Delivered: `whatsapp_contacts`, `whatsapp_campaigns`, and `whatsapp_deliveries` |
| Online Tithe Payment | Delivered: `online_giving_payments`, `payment_webhook_events`; add provider tables when Ghana gateways are introduced |
| Livestream Integration | Delivered: `livestream_settings`, `livestreams` |
| Sermon Archive | Delivered: `sermon_categories`, `sermons`, and the `sermon-media` Storage bucket |
| Prayer Request Portal | `prayer_requests`, `prayer_testimonies` |
| Church Voting System | `elections`, `ballots`, `ballot_options`, `voter_eligibility`, `votes`, `election_audit_events` |

Use foreign keys to existing `profiles`, `members`, `events`, `funds`, and
`contributions` tables where appropriate. Payment provider identifiers and
webhook event IDs should be unique to support idempotent processing.

## 5. Security Notes

- Enforce authorization with Supabase Row-Level Security, not UI visibility alone.
- Keep Stripe, Paystack, Flutterwave, Twilio, and WhatsApp credentials server-side in encrypted environment variables.
- Verify every payment and messaging webhook signature before processing it.
- Process payment webhooks idempotently and store provider event IDs to prevent duplicate contribution records.
- Never store card numbers, CVVs, mobile money PINs, or banking credentials.
- Restrict contribution data to authorized Admin, Pastor, and Treasurer roles.
- Record consent and unsubscribe status before sending SMS, WhatsApp, email, or push notifications.
- Treat prayer requests as sensitive pastoral data with restricted access and audit logs.
- Separate voter identity from ballot content where anonymous voting is required.
- Add audit events for role changes, payment reconciliation, prayer request access, and election administration.
- Use signed Supabase Storage URLs for restricted sermon files or pastoral documents.
- Review GDPR requirements for Hamburg operations, including data minimization, retention, consent, and account deletion workflows.

## 6. Development Order

1. Connect the current MVP UI to Supabase queries and server actions.
2. Add automated tests for role permissions, RLS policies, and treasury workflows.
3. Build communication consent preferences and the shared messaging tables.
4. Add SMS notifications with Twilio.
5. Extend the delivered WhatsApp module with webhook delivery receipts and automatic birthday scheduling.
6. Extend delivered Stripe online giving with Paystack or Flutterwave for Ghana support.
7. Extend the delivered YouTube livestream page with automatic YouTube API synchronization when needed.
8. Extend the delivered sermon archive with private resources and signed URLs when needed.
9. Build the React Native Expo mobile app against the stabilized APIs.
10. Extend the delivered prayer request portal with pastoral audit trails.
11. Build the church voting system last, after a dedicated security and governance review.

Each advanced module should ship behind a feature flag with database
migrations, RLS tests, monitoring, and an administrator rollout checklist.
