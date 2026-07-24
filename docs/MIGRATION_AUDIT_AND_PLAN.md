# Supabase and Vercel migration audit

This audit reflects the repository as inspected on 2026-07-23. The application
runtime has already been cut over to React, Express, and ordinary PostgreSQL.
Supabase is retained only as a read-only migration, verification, and rollback
source. No production deployment action is authorized by this document.

## Dependency audit

| Capability | Repository evidence | Current replacement or status |
|---|---|---|
| Supabase PostgreSQL | `supabase/schema.sql` defines profiles, meals, meal logs, weights, exercise types, and exercise logs. `server/migration-tooling/export-supabase.js` reads the source. | The live application uses `pg` through `server/db.js` and the schema in `server/migrations/`. |
| Supabase Auth | Source rows reference `auth.users`; the exporter reads an allowlisted subset of `auth.users` metadata. | Express owns password hashes, reset and verification tokens, sessions, CSRF protection, and account status. Imported users keep their UUID and must establish a new application password. |
| Supabase Storage | No Storage SDK calls, bucket configuration, or object identifiers exist. Legacy images were embedded as `photo_data_url` values inside meal JSON. | Embedded image data is deliberately audited and excluded. A future object store would be required if durable uploaded images are restored. |
| Row Level Security | `supabase/schema.sql` enables RLS and defines owner-only policies for all six public user-data tables. | The destination does not depend on PostgreSQL RLS. Express routes derive the user from a server-side session, and every model query scopes reads and writes by that user ID. This authorization layer must remain covered by integration tests. |
| Realtime | No channel, subscription, publication, or Supabase Realtime client usage exists. | No replacement is needed. |
| Edge Functions | No Supabase Edge Function source, configuration, or invocation exists. | No replacement is needed. |
| Generated database types | No generated Supabase/TypeScript database types exist. | No replacement is needed; this is a JavaScript application with server-side validation. |
| Supabase SQL function | `daily_calorie_totals(uuid)` exists in `supabase/schema.sql`. | Express/PostgreSQL queries and application calorie services replace the RPC behavior. |
| Vercel | No `vercel.json`, Vercel package, serverless function, runtime API, or Vercel environment-name dependency exists. | The Dockerfile builds React and serves it from Express. Production Compose attaches the app to `shared-net`, and Caddy proxies the public hostname. |

Ordinary PostgreSQL cannot by itself replace Supabase Auth's password/session
lifecycle, RLS authorization context, email delivery, Storage object service, or
Realtime transport. This repository replaces Auth and authorization with Express
services and uses Resend for transactional email. Storage and Realtime are not
currently used. Copying public tables alone is not an auth migration: the guarded
export retains user identity and confirmation metadata but intentionally excludes
Supabase password hashes, sessions, and secret tokens.

## Phased migration plan

1. Freeze the reviewed source revision, take a Supabase backup, create a read-only
   export role, and record source row counts without modifying production.
2. Build and test the pinned Docker image. Start an isolated PostgreSQL 16
   destination, run all ordered migrations, and verify migration/seed checksums.
3. Export allowlisted Supabase Auth metadata and public application rows using a
   read-only transaction. Export any browser-only data separately and explicitly.
4. Import into a disposable rehearsal database. Preserve user UUIDs, require
   migrated users to set new passwords, validate ownership relationships, reject
   orphaned rows, and compare per-table and per-user counts.
5. Rehearse backup restore and rollback. Keep Supabase unchanged and available
   throughout validation.
6. Test the Docker application before DNS changes using a temporary hostname or
   local hosts-file mapping through Caddy/TLS. Exercise sign-up, sign-in, password
   reset, profiles, meals, weights, exercise, authorization isolation, and CSRF.
7. After review and approval, take a final read-only export, import it into a fresh
   VPS database volume, rerun verification, start the app on `shared-net`, and add
   the reviewed Caddy route.
8. Change DNS only after pre-deployment checks pass. Monitor health, logs, row
   counts, account relationships, and core workflows. Retain the old Supabase and
   Vercel deployment during the rollback window.

Detailed export/import, count and relationship verification, backup/restore,
pre-deployment, post-deployment, Caddy, and rollback commands are maintained in
`server/migration-tooling/README.md` and `docs/DEPLOYMENT_OPERATIONS.md`.
