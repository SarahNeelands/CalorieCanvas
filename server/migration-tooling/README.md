# Migration tooling runbook

This phase provides read-only Supabase extraction, guarded PostgreSQL import, verification, browser export assistance, and legacy SQLite inventory. It does not remove Supabase or deploy the application. Read `INVENTORY.md` before running anything.

## Safety model

- Supabase extraction starts `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY` and runs only fixed allowlisted `SELECT` statements. The auth query excludes password hashes and token/session columns.
- The destination must be set explicitly. Import and verification refuse a matching source identity, any `*.supabase.co` destination, and obvious production destinations unless `--confirm-production` is explicitly supplied. That flag does not override the Supabase-destination refusal.
- One import is one PostgreSQL transaction. `--dry-run` performs all checks and writes, then rolls the transaction back. A failed import rolls back all records and session revocations from that run.
- Inserts preserve stable IDs and use `ON CONFLICT DO NOTHING`, followed by exact compatibility classification. Different records are reported as conflicts and are never merged by email or name.
- Reports contain IDs, counts and bounded validation descriptions, not passwords, password hashes, tokens, sessions, secrets, or full profiles. Export JSON contains application data and must be encrypted/protected and deleted only by an authorized operator after cutover.

## Environment

Set these outside the repository:

```powershell
$env:SUPABASE_SOURCE_DATABASE_URL='postgresql://READ_ONLY_USER:SECRET@SOURCE:5432/postgres'
$env:MIGRATION_DESTINATION_DATABASE_URL='postgresql://USER:SECRET@127.0.0.1:5433/calorie_canvas_rehearsal'
$env:MIGRATION_ENVIRONMENT='rehearsal'
```

The source account should be a dedicated read-only PostgreSQL role able to select the seven exported relations. The tools do not use the Supabase service-role or anon key.

## Exact rehearsal commands

From `server/`, create protected local folders, migrate the disposable destination, then export/import/verify:

```powershell
New-Item -ItemType Directory -Force migration-exports,migration-reports
$env:DATABASE_URL=$env:MIGRATION_DESTINATION_DATABASE_URL
npm run migrate
npm run migration:export -- --output=migration-exports/supabase.json
npm run migration:import -- --input=migration-exports/supabase.json --dry-run --report-dir=migration-reports
npm run migration:import -- --input=migration-exports/supabase.json --report-dir=migration-reports
npm run migration:verify -- --input=migration-exports/supabase.json --report-dir=migration-reports
```

Do not add `--confirm-production` during development. A production run requires separate authorization and adds that flag to both import and verification. Export refuses to overwrite an existing file.

## Browser-local procedure

1. While signed into the source application, open browser developer tools.
2. Paste the complete `browser-export-snippet.js` into the console and retain the downloaded JSON securely.
3. Do not clear localStorage. The helper never clears it.
4. In the later staging phase, sign in as the same preserved user, complete the required password reset, and let the existing Express-mode Phase 8 weight importer, Phase 9 exercise synchronizer, and catalog pending-operation processor reconcile stable IDs.
5. Compare browser/UI counts with the per-user server report. Keep the JSON and localStorage until committed import and manual verification are signed off.

Retries are idempotent because the existing clients use stable source/operation IDs. Never edit those IDs or merge records by similar names. Malformed raw localStorage is preserved in the export with `parseError=true` for manual review.

## Legacy SQLite

The legacy exporter opens SQLite with `mode=ro&immutable=1` and never selects the `auth_users.password` field:

```powershell
python migration-tooling/export-legacy-sqlite.py --database=../backend/data/calorie_canvas.sqlite3 --output=migration-exports/legacy-sqlite.json
```

This is a manual-review export, not an automatic import. Confirm the identity mapping and legacy numeric profile enum semantics before creating an approved transformation. The 74 legacy catalog rows differ in count from the 70-row authoritative shared seed and must be compared by stable ID, never name.

## Transformations and replay

- User UUIDs/emails/confirmation timestamps are retained. Emails are trimmed/lowercased. Every imported account has no password, requires reset, and has destination sessions removed transactionally.
- Profiles are strictly validated. Invalid rows are reported and skipped.
- User catalog UUIDs and ownership are retained. Source schemas without archive/update fields map to null archive and creation-time update. Embedded data-URL photos are counted and removed.
- Shared catalog rows are loaded directly from `src/services/builtInIngredients.js`; its current 70 stable IDs are authoritative.
- Meal UUIDs and log UUIDs are retained. Macro snapshots use source log values. Additional nutrition derives only from a catalog conversion explicitly describing a 100 g serving, scaled by resolved grams. Otherwise zero is used solely because the destination columns are non-null, with unavailable fields recorded in the snapshot/report.
- Historical browser timezone offsets do not exist in Supabase. UTC calendar date and offset `0` are stored and explicitly reported as unknown.
- Weight variants map exactly as listed in `INVENTORY.md`; unknown units are skipped. Exact original spelling is retained in `weights.original_unit`. `source_record_id` prevents replay duplication. A sole untracked destination row with the exact owner/date/value/unit is adopted as the profile-setup row and re-keyed to the source UUID; multiple candidates are never collapsed. Profile weight is synchronized to date/created-time/UUID deterministic latest.
- User exercise definition IDs remain owner-scoped. Equivalent built-in stable IDs reuse shared definitions. Logs retain UUIDs and immutable definition snapshots.

Replaying an identical export classifies rows as existing and creates no duplicates. A conflict is skipped and reported. Fix source data or an explicitly reviewed destination conflict, then retry the whole file. Because the importer never deletes application data, rollback of a committed rehearsal means dropping the isolated rehearsal schema/database. A production rollback must restore a pre-import PostgreSQL backup; do not improvise record deletion.

## Reports

Every import/verification emits `.json` and `.txt`. A typical per-user JSON fragment is:

```json
{
  "11111111-1111-4111-8111-111111111111": {
    "profile": { "source": 1, "destination": 1 },
    "catalogItems": { "source": 3, "destination": 3 },
    "mealLogs": { "source": 10, "destination": 10 },
    "weights": { "source": 5, "destination": 5 },
    "exerciseDefinitions": { "source": 2, "destinationUserOwned": 1 },
    "exerciseLogs": { "source": 4, "destination": 4 }
  }
}
```

The shared exercise difference can be expected when a source user definition is deduplicated to a server shared stable ID. Any issue entry or count mismatch requires review.

## Production migration checklist (not authorized in this phase)

- Freeze application writes or establish a documented final-delta window.
- Create and test a destination PostgreSQL backup and restore.
- Create least-privilege read-only Supabase credentials; test `READ ONLY` extraction.
- Audit the export's `audit.weightUnits` before import; approve every variant.
- Resolve duplicate emails, missing auth/profile owners, invalid records, catalog references, and legacy identity conflicts.
- Export each active browser's local data without clearing it.
- Run a fresh export, checksum it, protect it, and record source row counts.
- Apply migrations through `012` to a fresh destination and run dry-run import.
- Review both reports, then obtain explicit production authorization.
- Run committed import and verification; compare all per-user counts and UUID relationships.
- Confirm migrated users have no sessions/password hash and require password reset.
- Test password reset, catalog, meals, weights, exercises and browser reconciliation on staging before DNS.
- Keep Supabase read-only/intact and retain backups until post-cutover acceptance and rollback window completion.
