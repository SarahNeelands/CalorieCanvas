# Calorie Canvas Instructions

## Project goal

Calorie Canvas is currently hosted using Vercel and Supabase.

The goal is to migrate it to my existing Ubuntu VPS while preserving all
existing application functionality and user data.

## Existing VPS architecture

Server:
- Ubuntu VPS
- Server IP: 178.156.250.200
- Managed partly through Portainer
- Docker is used for application deployment
- Caddy is used as the reverse proxy
- HTTPS is managed automatically by Caddy
- Shared Docker network: shared-net

Existing deployment examples:
- getbud.serenx.net: Budget Tracker
- slimemotive.serenx.net: Motivation Slime
- dear.serenx.net: Diary app
- job.serenx.net: Job Pipeline
- serenx.net: Portfolio

Calorie Canvas should follow the same deployment pattern.

## Intended Calorie Canvas deployment

Preferred domain:
- caloriecanvas.serenx.net

Expected architecture:
- Frontend and application packaged in Docker
- PostgreSQL database running in Docker
- Persistent Docker volume for PostgreSQL
- Application connected to shared-net
- Caddy proxies caloriecanvas.serenx.net to the application container
- Secrets supplied through environment variables
- No secrets committed to Git

## Migration requirements

Before changing code:

1. Inspect the entire repository.
2. Identify every Supabase dependency.
3. Identify whether the project uses:
   - Supabase PostgreSQL
   - Supabase Auth
   - Supabase Storage
   - Row Level Security policies
   - Realtime subscriptions
   - Edge Functions
   - Supabase-generated database types
4. Identify all Vercel-specific functionality.
5. Produce a migration plan before implementing it.
6. Explain anything that cannot be replaced with ordinary PostgreSQL alone.

## Data safety

Existing production data must not be modified or deleted during development.

The migration must include:

- A Supabase database export procedure
- A database import procedure for the VPS PostgreSQL container
- Verification of row counts after import
- Verification of user account relationships
- A rollback plan
- A backup procedure
- A method to test the migrated application before changing DNS

Never assume that copying database tables also migrates Supabase Auth or
Storage correctly.

## Development expectations

- Make small, reviewable changes.
- Preserve existing functionality.
- Do not rewrite the application unnecessarily.
- Run existing tests.
- Add tests for changed database and authentication behaviour.
- Use health checks where practical.
- Use pinned or stable Docker image versions.
- Do not expose PostgreSQL publicly.
- Do not hard-code IP addresses, passwords, tokens, or environment secrets.
- Update README documentation with local and VPS deployment steps.

## Required deliverables

Codex should create:

1. A written dependency audit.
2. A phased migration plan.
3. Dockerfile.
4. docker-compose.yml.
5. .env.example.
6. PostgreSQL initialization or migration scripts.
7. Caddy configuration instructions.
8. Supabase export and VPS import instructions.
9. Pre-deployment verification checklist.
10. Post-deployment verification checklist.
11. Rollback instructions.

Do not deploy directly to the production VPS until the migration plan and code
changes have been reviewed.