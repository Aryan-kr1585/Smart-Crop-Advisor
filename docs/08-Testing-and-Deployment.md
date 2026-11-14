# 8. Testing and Deployment

The API includes a Node.js test for scoring. Prisma schema validation, migration/seed on a disposable database, and the frontend production build passed during this implementation pass; the automated test suite was not run. Expand coverage to the acceptance criteria below before release; passing status is not claimed.

## Test strategy
| Type | Required focus |
|---|---|
| Unit | Domain rules, Zod schemas, scoring, badge criteria, date boundaries |
| API | Contracts, status/errors, validation, pagination, rate limits, notification opt-out, own-data export, account erasure and evidence cleanup |
| Integration | Express + Prisma + disposable PostgreSQL, migrations and transactions |
| Authentication | Registration, bcrypt, invalid/expired JWT and password-reset tokens, single-use reset, generic reset responses, session revocation, logout policy |
| Authorization | Roles, school/class scope, ownership, admin-only routes, direct API access |
| Points | Server-side awards, approval outcomes, ledger totals, reversals |
| Duplicate prevention | Retry/replay; one award per event/idempotency key |
| Upload | MIME/size, unauthorized signing, malformed content, provider failure, orphan cleanup |
| UI | Primary journeys, loading/error/empty, keyboard and responsive states |
| Performance | Classroom concurrency, latency, pagination and leaderboard query cost; set numeric targets before release |

Use synthetic fixtures only, never real student data or production credentials.

## Security and privacy
Use bcrypt; managed JWT secrets; Zod validation; server-side resource authorization; HTTPS; restrictive CORS; auth/upload rate limits; secure headers; reviewed dependencies; Prisma parameterized queries. Restrict uploads and verify ownership/size/type server-side. Logs must omit passwords, tokens, private URLs, and unnecessary student details. Export and user-requested evidence deletion are implemented; approve consent/age, minimization, retention periods, backup expiry, incident handling, leaderboard visibility, and applicable legal duties before production.

## Local setup and environment
Package manifests, lockfiles, Node 24 pin, scripts, and a GitHub Actions validation/build workflow exist. See the repository [README](../README.md) for local setup. Use local PostgreSQL or non-production Neon; configure placeholder-only env; apply the checked-in Prisma migration; start API/client with documented scripts and local CORS/API URL. The frontend reads `VITE_API_BASE_URL` at build time; leave it unset for local Vite proxy use. Fresh migration and seed were exercised on a disposable database.

Proposed environment names: `DATABASE_URL`, `JWT_SECRET` (or key pair), `CLIENT_ORIGIN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NODE_ENV`, API port. Validate configuration at startup, separate secrets per environment, never expose secrets through Vite variables or logs.

## Deployment and CI/CD
- **Cloudflare Pages:** use `frontend` as the project root, `npm run build` as the build command, and `dist` as the build output. Set the production build variable `VITE_API_BASE_URL` to the Render service origin, with no `/api/v1` suffix; the client appends that path. Rebuild after changing this value.
- **Render:** run from the repository root so both `backend/` and `database/` are available. Build with `cd backend && npm ci && npx prisma generate --schema=../database/prisma/schema.prisma && npx prisma migrate deploy --schema=../database/prisma/schema.prisma`; start with `cd backend && npm start`. Set `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` (the exact Pages origin), `RESEND_API_KEY`, and `MAIL_FROM`. Use Cloudinary credentials for persistent evidence uploads; Render local filesystem is ephemeral.
- **Neon:** separate environment databases, least privilege, TLS, backups, reviewed migrations.
- **Cloudinary:** restricted upload policy and retention/cleanup.
- **GitHub Actions:** current CI installs both lockfiles, validates Prisma, checks backend syntax, and builds the frontend. API/integration/security checks and a reviewed production deployment workflow remain to be added.

## Production checklist
- [ ] Scope, privacy/consent, terms, and content policy approved.
- [ ] Secrets configured without printing values; HTTPS/CORS/token policy/rate limits checked.
- [ ] Resend API key and verified sender configured; reset emails and generic responses verified without logging tokens.
- [ ] Migration reviewed; backup and restore tested.
- [ ] Secure admin bootstrap; demo accounts removed/disabled.
- [ ] Upload authorization, limits, and retention verified.
- [ ] Logs, health checks, error alerting, ownership, and rollback defined.
- [ ] Smoke-test auth, learning, submission/review, points, and scoped access.
- [ ] Accessibility, mobile, performance, and release checks reviewed.
- [ ] README and status match deployed reality.

Confirm database backup/restore capability, retention, recovery objectives, and restore owner. Database backups may not include Cloudinary assets; document consistency and asset retention. Do not claim recovery objectives until tested.
