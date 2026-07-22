# Calorie Canvas

Calorie Canvas is a React application backed by Express and PostgreSQL. Express is
the only supported application runtime: the browser never connects directly to a
database or to Supabase. Legacy browser data is retained only for explicit,
authenticated recovery/import flows.

## Local development

Requirements: Node.js 20 or newer and PostgreSQL 16 (a disposable Docker database
is suitable). Install both dependency trees:

```powershell
npm ci
npm --prefix server ci
```

Copy the relevant values from `.env.example` into local, uncommitted environment
files. Then create the schema and start both processes:

```powershell
$env:DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5432/calorie_canvas'
npm run migrate:backend
npm run start:backend
npm start
```

The React development server uses `REACT_APP_API_BASE_URL` when supplied. Hosted
builds default to same-origin `/api`. Invalid API URLs fail clearly; there is no
fallback database or authentication mode.

Health endpoints are `GET /api/health` (process) and `GET /api/ready`
(PostgreSQL). Private application routes require a valid PostgreSQL-backed session,
and every state-changing private route also requires its session-bound CSRF token.

## Configuration

Browser configuration:

- `REACT_APP_API_BASE_URL` — optional absolute HTTP(S) API URL or root-relative
  path; omit in hosted builds to use `/api`.

Server configuration:

- `DATABASE_URL` — PostgreSQL URL; required in production.
- `DATABASE_SSL` — `true` or `false`.
- `SERVER_HOST`, `SERVER_PORT` — listener (defaults `127.0.0.1:3001`).
- `APP_ORIGINS` — comma-separated trusted browser origins; required in production.
- `BCRYPT_ROUNDS`, cookie names, session/reset/verification TTLs, and auth rate-limit
  settings documented in `.env.example`.
- `SESSION_COOKIE_SECURE` must be `true` behind production HTTPS.

No `REACT_APP_SUPABASE_*` variable or runtime-mode variable is supported.

## Migrations and shared data

Ordered SQL files in `server/migrations/` must remain a contiguous sequence. The
runner records version, filename, and SHA-256 checksum in `app_migrations`, refuses
reordering or edited applied files, and applies each migration transactionally.

Migration `010` creates the shared exercise definitions. Migration `012` creates a
data-seed ledger; the migration runner then loads the authoritative shared catalog
from `src/services/builtInIngredients.js`. The versioned seed checksum prevents a
changed seed from being silently reapplied.

Run migrations only against an explicitly selected development or rehearsal
database:

```powershell
npm run migrate:backend
```

## Verification

```powershell
npm run build:backend
npm run test:backend
$env:TEST_DATABASE_URL='postgresql://USER:PASSWORD@127.0.0.1:5433/calorie_canvas_test'
npm run test:backend:integration
$env:CI='true'
npm run test:frontend -- --watchAll=false
npm run build:frontend
```

`build/` is intentionally versioned in this repository. Commit only the final
verified build output, not intermediate bundles.

## Read-only migration sources

Supabase is retained only as a read-only export, verification, and rollback source.
Its source URL is used solely by the server-side migration tooling and must never be
prefixed `REACT_APP_` or bundled into React. The complete guarded export/import
runbook is [server/migration-tooling/README.md](server/migration-tooling/README.md),
with mappings in [server/migration-tooling/INVENTORY.md](server/migration-tooling/INVENTORY.md).

The old Rust runtime has been retired. The unreviewed
`backend/data/calorie_canvas.sqlite3` is intentionally retained read-only; see
[backend/README.md](backend/README.md) and use the legacy exporter for manual review.

## Deployment status

Docker, Caddy, VPS staging, DNS cutover, and the production import are separate,
not-yet-started phases. Do not run migration tooling against production or alter the
Supabase project without explicit approval and the runbook safeguards.
