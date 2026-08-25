# Calorie Canvas deployment operations

This runbook is exclusively for `https://caloriecanvas.serenx.net` and a fresh,
empty PostgreSQL database. Do not run Supabase export/import tooling and do not
import the retained SQLite database.

## Install and configure

Place the reviewed source at `/opt/caloriecanvas`. Create the private environment
file from `deploy/production/.env.production.example`, use a unique base64url-style
database password, and restrict it to the deployment account:

```sh
cd /opt/caloriecanvas
umask 077
cp deploy/production/.env.production.example .env.production
chmod 600 .env.production
docker network inspect shared-net >/dev/null
```

Use the existing Resend key, a verified sender, and only approved recipients. The
database password in `DATABASE_URL` must be the URL-encoded form of
`POSTGRES_PASSWORD`. `EMAIL_VERIFICATION_REQUIRED=false` temporarily signs new
accounts in immediately; change it to `true` to restore verification before login.
Password-reset delivery still requires the email provider while verification is
paused.

## Validate, build, migrate, and start

```sh
cd /opt/caloriecanvas
docker compose --env-file .env.production -f deploy/production/compose.yml config --quiet
docker compose --env-file .env.production -f deploy/production/compose.yml build --pull app
docker compose --env-file .env.production -f deploy/production/compose.yml up -d db
docker compose --profile tools --env-file .env.production -f deploy/production/compose.yml run --rm migrate
docker compose --profile tools --env-file .env.production -f deploy/production/compose.yml run --rm app node server/scripts/verify-staging.js
docker compose --env-file .env.production -f deploy/production/compose.yml up -d app
```

Verification must report 16 migrations, latest version 16, one seed ledger row,
70 shared catalog items, five shared exercise definitions, zero users, and zero
sessions before application testing.

## Health and logs

```sh
curl --fail --silent https://caloriecanvas.serenx.net/api/health
curl --fail --silent https://caloriecanvas.serenx.net/api/ready
docker compose --env-file .env.production -f deploy/production/compose.yml ps
docker compose --env-file .env.production -f deploy/production/compose.yml logs --since 10m app db
```

## PostgreSQL backup and restore rehearsal

Store backups outside the checkout:

```sh
sudo install -d -m 700 /var/backups/caloriecanvas
umask 077
backup=/var/backups/caloriecanvas/caloriecanvas-$(date -u +%Y%m%dT%H%M%SZ).dump
docker compose --env-file .env.production -f deploy/production/compose.yml exec -T db \
  pg_dump -U caloriecanvas_user -d caloriecanvas -Fc > "$backup"
chmod 600 "$backup"
test -s "$backup"
```

Restore only into the disposable verification database:

```sh
docker compose --env-file .env.production -f deploy/production/compose.yml exec -T db \
  createdb -U caloriecanvas_user caloriecanvas_restore_check
docker compose --env-file .env.production -f deploy/production/compose.yml exec -T db \
  pg_restore -U caloriecanvas_user -d caloriecanvas_restore_check --exit-on-error < "$backup"
docker compose --env-file .env.production -f deploy/production/compose.yml exec -T db \
  psql -U caloriecanvas_user -d caloriecanvas_restore_check -c \
  "select count(*) from app_migrations; select count(*) from shared_catalog_items;"
docker compose --env-file .env.production -f deploy/production/compose.yml exec -T db \
  dropdb -U caloriecanvas_user caloriecanvas_restore_check
```

## Caddy and rollback

Back up the complete active Caddyfile before adding only the reviewed block from
`deploy/production/Caddyfile.example`. Validate the complete configuration inside
the existing `caddy` container, then reload it gracefully. Never restart unrelated
application containers.

Application rollback selects the prior image tag and recreates only `app`. A
database rollback restores a verified backup into a new database/volume and then
changes `DATABASE_URL`; never overwrite the active database in place. Removing the
Caddy block and reloading Caddy removes routing without deleting the database
volume.

## Routine maintenance

Monitor `docker stats --no-stream`, `docker system df`, the backup directory, and
the Docker volume filesystem. Rotate database and Resend credentials independently.
After a backup, remove expired sessions and consumed/revoked/expired token rows;
retain migration and seed ledgers permanently. Update by backing up, building a
unique tag, running migrations once, recreating only `app`, and checking readiness.
