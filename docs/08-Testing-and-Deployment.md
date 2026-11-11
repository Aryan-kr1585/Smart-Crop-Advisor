# 8. Testing and Deployment

No application code or test framework was found. Select JS-compatible tools during setup; tests must map to acceptance criteria and must actually run before a pass is claimed.

## Test strategy
| Type | Required focus |
|---|---|
| Unit | Domain rules, Zod schemas, scoring, badge criteria, date boundaries |
| API | Contracts, status/errors, validation, pagination, rate limits |
| Integration | Express + Prisma + disposable PostgreSQL, migrations and transactions |
| Authentication | Registration, bcrypt, invalid/expired token, logout/revocation policy |
| Authorization | Roles, school/class scope, ownership, admin-only routes, direct API access |
| Points | Server-side awards, approval outcomes, ledger totals, reversals |
| Duplicate prevention | Retry/replay; one award per event/idempotency key |
| Upload | MIME/size, unauthorized signing, malformed content, provider failure, orphan cleanup |
| UI | Primary journeys, loading/error/empty, keyboard and responsive states |
| Performance | Classroom concurrency, latency, pagination and leaderboard query cost; set numeric targets before release |

Use synthetic fixtures only, never real student data or production credentials.

## Security and privacy
Use bcrypt; managed JWT secrets; Zod validation; server-side resource authorization; HTTPS; restrictive CORS; auth/upload rate limits; secure headers; reviewed dependencies; Prisma parameterized queries. Restrict uploads and verify ownership/size/type server-side. Logs must omit passwords, tokens, private URLs, and unnecessary student details. Decide consent/age, minimization, access/export/deletion, evidence retention, incident handling, leaderboard visibility, and applicable legal duties before production.

## Local setup and environment
No package manifests/scripts exist, so exact install/run commands are unsupported. After implementation: choose supported Node version; use local PostgreSQL or non-production Neon; configure placeholder-only env example; run reviewed Prisma migrations and demo seeds; start API/client with documented scripts and local CORS/API URL.

Proposed environment names: `DATABASE_URL`, `JWT_SECRET` (or key pair), `CLIENT_ORIGIN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NODE_ENV`, API port. Validate configuration at startup, separate secrets per environment, never expose secrets through Vite variables or logs.

## Deployment and CI/CD
- **Neon:** separate environment databases, least privilege, TLS, backups, reviewed migrations.
- **Render:** Node/Express, health endpoint, secrets, HTTPS, CORS, structured logs, controlled migration.
- **Vercel:** static client, correct API URL, preview/production separation.
- **Cloudinary:** restricted upload policy and retention/cleanup.
- **GitHub Actions:** lockfile-based install, lint/build/test/security checks, protected deploy environments and reviewed production workflow.

## Production checklist
- [ ] Scope, privacy/consent, terms, and content policy approved.
- [ ] Secrets configured without printing values; HTTPS/CORS/token policy/rate limits checked.
- [ ] Migration reviewed; backup and restore tested.
- [ ] Secure admin bootstrap; demo accounts removed/disabled.
- [ ] Upload authorization, limits, and retention verified.
- [ ] Logs, health checks, error alerting, ownership, and rollback defined.
- [ ] Smoke-test auth, learning, submission/review, points, and scoped access.
- [ ] Accessibility, mobile, performance, and release checks reviewed.
- [ ] README and status match deployed reality.

Confirm database backup/restore capability, retention, recovery objectives, and restore owner. Database backups may not include Cloudinary assets; document consistency and asset retention. Do not claim recovery objectives until tested.
