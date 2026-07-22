# Calorie Canvas migration inventory

This inventory describes the source as implemented in `supabase/schema.sql`, the destination migrations through `012`, active browser storage keys, and the retained legacy SQLite schema. Supabase is an export-only source.

| Data | Source | Destination | Identifier and ownership | Transformation and missing fields | Verification |
|---|---|---|---|---|---|
| Authentication users | `auth.users` metadata only | `users` | UUID retained; email identifies a conflicting account but never causes a merge | Lowercase/trim email; retain confirmation and reliable timestamps; set `password_hash=NULL`, `must_reset_password=true`; do not select hashes, tokens or sessions | UUID/email/reset-state checks and duplicate-email query |
| Profiles | `public.profiles` | `profiles` | `user_id` UUID FK | Strict enum/date/range/draft/state validation; no questionable coercion | Per-user count, FK/orphan checks |
| User catalog | `public.meals` | `meals` | UUID and owner UUID retained | Source has no archive/update fields in the checked-in schema, so `archived_at=NULL` and `updated_at=created_at`; embedded `photo_data_url` is removed and counted | UUID/owner/count and missing log-reference checks |
| Shared catalog | `src/services/builtInIngredients.js` | `shared_catalog_items` | Stable `seed-vegetable-*` text ID, no user owner | Loaded directly from the authoritative module (currently 70 rows); embedded null photo field omitted | Stable-ID set and count |
| Meal logs | `public.meal_logs` | `meal_logs` | UUID/owner retained; UUID `meal_id` becomes text | Snapshot catalog row before import; macros come directly from log; micros derive only from a reliable 100 g conversion and resolved grams; unavailable values use destination-required zero plus explicit snapshot/report metadata. Source has no meal type, position or browser timezone | UUID/owner/count, snapshot, catalog coverage, orphan checks |
| Weights | `public.weights` | `weights` | UUID/owner retained; `source_record_id=supabase:<uuid>` | Reviewed map: `kg`, `kgs`, `kilogram(s)` to `kg`; `lb`, `lbs`, `pound(s)` to `lb`. Unknown units are rejected. Exact spelling goes to `original_unit`. Ordering is date, created time, UUID. Profile latest weight is synchronized in the transaction | UUID/source uniqueness, unknown-unit report, deterministic latest/profile query |
| Exercise definitions | `public.exercise_types` | `exercise_definitions` | Stable text ID scoped by owner | Equivalent shared stable IDs are reused; user definitions otherwise remain owner-scoped | Stable IDs, per-user counts and conflicts |
| Exercise logs | `public.exercise_logs` | `exercise_logs` | UUID/owner retained; `source_record_id=supabase:<uuid>` | Definition snapshot created; duration/timestamp retained; unknown browser offset is represented as UTC date and offset `0` | UUID/source uniqueness, missing definitions and per-user counts |
| Email verification | `auth.users.email_confirmed_at` / `confirmed_at` | `users.email_verified_at` | User UUID | First available Supabase confirmation timestamp | User identity verification |
| Browser weights | `localStorage['cc.weights']` | Existing authenticated weight import API | Stable local `source_record_id` supplied by Phase 8 logic | User explicitly exports; existing Express-mode reconciliation is idempotent | Keep key, compare UI/server history and reconciliation report |
| Browser exercises | `localStorage['exercise_page_state_v3']` | Existing authenticated exercise sync API | Stable log/definition IDs supplied by Phase 9 logic | Shared built-ins dedupe by stable ID; user triggers existing sync | Keep key, compare UI/server history |
| Pending catalog | `pending_catalog_sync_v1`, `local_catalog_items_v1`, `local_meal_logs_v1` | Existing catalog/meal APIs | Existing stable record and operation IDs | Export helper preserves queues; the running app remains responsible for authenticated reconciliation | Confirm queue drains only after successful server responses |
| Legacy media | `meals.unit_conversions.photo_data_url` and browser catalog values | Not imported | No independent storage ID/bucket exists | Data-URL byte counts are audited, content is excluded; no Supabase Storage bucket is used in repository code | Export audit and manual media decision |
| Legacy Rust/SQLite | `backend/data/calorie_canvas.sqlite3`: `auth_users`, `users`, `weight_entries`, `catalog_items` | Manual review before any destination import | Text/integer legacy IDs; ownership mapping uncertain | Read-only exporter excludes plaintext legacy password. Numeric profile enums and possible shared-catalog duplicates are intentionally not guessed | Compare emails/IDs and classify conflicts manually |

## Timestamp rule

Supabase meal and exercise timestamps are absolute instants, but the schema did not save the browser's historical offset. The destination stores the UTC calendar date and `timezone_offset_minutes=0`; reports explicitly label the offset as unknown. This is not a claim that the user was in UTC.

## Known local SQLite audit

The retained SQLite file was inspected read-only on 2026-07-22:
`auth_users=1`, `users=1`, `weight_entries=1` (distinct unit: `kg`), and
`catalog_items=74`. Stable-ID comparison proves that all 70 SQLite shared rows
exactly cover the 70 authoritative shared IDs, with none missing or unexpected.
The remaining four are user-owned records: three belong to the single legacy UUID
and one clearly marked test record has owner `test`. They are not shared-catalog
additions and must not be seeded. Whether the legacy email/UUID corresponds to a
current Supabase user remains unresolved until a real read-only Supabase export is
available. The legacy password value was neither read nor exported.
