# Calorie Canvas

Calorie Canvas is a React application backed by Express and PostgreSQL. Express is
the only supported application runtime: the browser never connects directly to a
database. Accounts and their data are created natively by this application.

## Local development

Requirements: Node.js 20 or newer and PostgreSQL 16 (a disposable Docker database
is suitable). Install both dependency trees:

```powershell
npm ci
npm --prefix server ci
```

The shortest local test path requires only Docker:

```powershell
npm run local:up
```

Open `http://127.0.0.1:3001`. The local Compose stack builds the frontend and API,
runs migrations automatically, and starts an isolated PostgreSQL container.
By default, new accounts are signed in immediately and no email secret is needed.
To exercise real verification and password-reset delivery with the ignored
`.env.production` Resend settings, run `npm run local:email:up` instead.

The database is available to backend integration tests on port `55435` by
default. Set `CALORIE_CANVAS_DB_PORT` before starting Compose if that port is
already occupied:

```powershell
$env:TEST_DATABASE_URL='postgresql://caloriecanvas:local-only-password@127.0.0.1:55435/caloriecanvas'
npm run test:backend:integration
```

Stop the stack with `npm run local:down`. To delete
only its disposable local database and start fresh, use the same command with
`-- --volumes`.

For separate frontend and backend processes, install both dependency trees.
You may also leave `npm run local:up` running and start the React development
server with `npm start`. A page at either `localhost:3000` or
`127.0.0.1:3000` automatically calls the API using the matching hostname on port
3001, which keeps development session cookies on the same site.

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
- `EMAIL_VERIFICATION_REQUIRED` enables verification-token delivery and the
  pre-login verification gate; production defaults it to `true`.
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

## Faster food logging

The dashboard includes account-scoped **My Usuals** shortcuts. A usual stores a
catalog item plus the signed-in user's default portion (for example, two chocolate
squares or 25 g of Cheetos). One tap creates a normal PostgreSQL meal-log row,
updates daily totals, and offers immediate undo. Repeated logs remain separate
events, including in Recent Meals, so each timestamp can be edited or deleted
independently. My Usuals can be hidden through the profile's Dashboard Modules
settings without deleting any saved usuals.

**Rebuild My Day** supports transactional bulk entry of saved foods and
calorie-only estimates. The server validates every row before committing the
batch and rolls the complete transaction back if any catalog item is inaccessible
to the signed-in account.

The recipe builder keeps ingredient search open for multiple selections, accepts
multiline ingredient lists for reviewed catalog matching, and presents amounts in
one editable list. Recipes may be saved as drafts while awaiting their final cooked
weight. Drafts cannot be logged or pinned as usuals until a final weight or serving
count makes portion nutrition calculable.

Migrations `013_create_food_usuals.sql`, `014_require_native_accounts.sql`, and
`015_add_usuals_dashboard_preference.sql` add the user-owned shortcut table,
enforce fresh application-owned accounts, and add the Usuals dashboard preference. Run
the normal migration command before testing against an existing development
database.

`build/` is intentionally versioned in this repository. Commit only the final
verified build output, not intermediate bundles.

## Deployment status

The single-host deployment package is defined by `Dockerfile` and
`deploy/production/compose.yml`. Deployment, Caddy, backup/restore, verification,
maintenance, and rollback instructions are in
[docs/DEPLOYMENT_OPERATIONS.md](docs/DEPLOYMENT_OPERATIONS.md). The application
supports fresh PostgreSQL-backed accounts only; there is no legacy account-import
path.
