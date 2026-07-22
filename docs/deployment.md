# Production deployment

## Required environment

Use `.env.example` as the inventory. Production requires PostgreSQL URLs, Better Auth URL/secret, SMTP configuration, sender address, and `CRON_SECRET`. Redis, Stripe, Ollama, and Sentry remain optional. Store secrets in the deployment platform, never in Git.

## Docker Compose

1. Create `.env` and replace every placeholder.
2. Run `docker compose build`.
3. Run `docker compose up -d`.
4. Verify `/api/health/live` and `/api/health/ready`.

The one-shot `migrate` service must finish successfully before the app starts. PostgreSQL, Redis, uploaded files, and database data use named volumes. Put TLS and rate limiting in a reverse proxy or load balancer.

`NEXT_PUBLIC_*` values are compiled into browser assets. Rebuild the image after changing them; private database, auth, SMTP, and Sentry-token credentials are injected only when containers run.

## Vercel

Create the project, configure all application variables for Production and Preview, and add these GitHub environment secrets: `DATABASE_URL`, `DIRECT_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, and optionally `SENTRY_AUTH_TOKEN`. The production workflow applies migrations once, builds a prebuilt Vercel artifact, then deploys it.

Vercel's filesystem is ephemeral. For Vercel production, replace local CSV/report storage with durable object storage before accepting uploads; `UPLOAD_DIR` is intended for a mounted self-hosted volume.

## Backup and restore

Run `npm run backup:database` from a trusted host with PostgreSQL client tools and `DIRECT_URL`. Schedule it daily and copy encrypted dumps to separate object storage. Test restores regularly:

```bash
pg_restore --clean --if-exists --no-owner --dbname="$DIRECT_URL" backups/<file>.dump
```

Managed PostgreSQL point-in-time recovery is preferable to a single local dump. Keep retention aligned with your recovery policy.

## Monitoring

- Liveness: `GET /api/health/live` confirms the process can respond.
- Readiness: `GET /api/health/ready` checks PostgreSQL and reports the active cache layer.
- Logs: application logs use one-line JSON suitable for Docker, Vercel, Loki, or any log drain.
- Sentry: set server/client DSNs and build-time organization/project/token variables. No telemetry is sent when DSNs are empty.

Alert on readiness failures, HTTP 5xx rate, latency, database saturation, storage growth, backup age, cron failures, and Sentry error regressions.
