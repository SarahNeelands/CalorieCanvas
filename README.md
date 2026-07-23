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

The shortest local test path requires only Docker:

```powershell
docker compose -f deploy/local/compose.yml up --build
```

Open `http://127.0.0.1:3001`. The local Compose stack builds the frontend and API,
runs migrations automatically, and starts an isolated PostgreSQL container.
New accounts are signed in immediately because email verification is temporarily
disabled. No email provider or secret is needed.

The database is available to backend integration tests on port `5433`:

```powershell
$env:TEST_DATABASE_URL='postgresql://caloriecanvas:local-only-password@127.0.0.1:5433/caloriecanvas'
npm run test:backend:integration
```

Stop the stack with `docker compose -f deploy/local/compose.yml down`. To delete
only its disposable local database and start fresh, use the same command with
`--volumes`.

For separate frontend and backend processes, install both dependency trees:

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
- `EMAIL_VERIFICATION_REQUIRED` is temporarily `false`; set it to `true` to restore
  verification-token delivery and the pre-login verification gate.
- `SESSION_COOKIE_SECURE` must be `true` behind production HTTPS.
- `PUBLIC_APP_ORIGIN` is the exact public origin used in verification/reset links.
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, retry/timeout settings,
  and an optional staging-only `EMAIL_ALLOWED_RECIPIENTS` allowlist configure mail.
- `FRONTEND_DIRECTORY` enables the single-container same-origin React build.

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
The repository-wide dependency audit and phased plan are in
[docs/MIGRATION_AUDIT_AND_PLAN.md](docs/MIGRATION_AUDIT_AND_PLAN.md).

The old Rust runtime has been retired. The unreviewed
`backend/data/calorie_canvas.sqlite3` is intentionally retained read-only; see
[backend/README.md](backend/README.md) and use the legacy exporter for manual review.

## Deployment status

The single-host deployment package is defined by `Dockerfile` and
`deploy/production/compose.yml`. Deployment, Caddy, backup/restore, verification,
maintenance, and rollback instructions are in
[docs/DEPLOYMENT_OPERATIONS.md](docs/DEPLOYMENT_OPERATIONS.md). This deployment
uses a fresh database and must not run Supabase export/import tooling or alter the
Supabase project.
