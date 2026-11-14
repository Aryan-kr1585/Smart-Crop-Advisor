# 9. Project Status

**Inspection date:** 2026-11-15 (Asia/Kolkata)

## Observed repository state

| Area | State |
|---|---|
| Repository identity | `Smart-Crop-Advisor`, branch `main`; local Git status inspected before edits |
| Top-level layout | `frontend/` for React/Vite; `backend/` for Express/runtime/tests; `database/` for Prisma schema and migrations; `docs/` for project documentation |
| Runtime/setup | Node 24 pinned in `.nvmrc` and package engine constraints; npm lockfiles checked in for frontend and backend; root setup uses `npm ci` |
| Product scope | Implemented code and package names call the product EcoQuest (environmental education); the supplied title describes crop advisory. Official scope needs confirmation |
| Frontend | React/Vite client with public, student, teacher, and admin routes |
| Backend | Express API with auth, validation, RBAC, rate limiting, errors, and health endpoint |
| Database | Prisma PostgreSQL schema, initial migration, and demo seed. Initial migration applied successfully and demo records seeded in a disposable PostgreSQL 18 database |
| Core workflows | Lessons, quiz authoring/attempts, tasks/submissions/review, points, badges, challenges, leaderboard, notices, schools/classes, account management |
| Uploads | Local API disk path by default; optional Cloudinary signing/retrieval support; consent and retention policy unresolved |
| Verification | Prisma schema validation passed; migration applied and demo seed completed on a disposable PostgreSQL 18 database; frontend production build passed. Automated tests were not run |
| Deployment | No CI workflow or production deployment configuration found |
| Secrets | `.env` exists locally and is ignored; its values were not read or changed |

## Work completed in this pass

- Fixed registration to populate the shared React Query auth state without a hard page reload.
- Matched the submission form to the API's existing image-only evidence support.
- Added evidence image display to teacher review cards.
- Rejected duplicate answers to the same quiz question at request validation.
- Replaced stale setup/status/roadmap documentation with the observed implementation, setup steps, known limits, and verification state.
- Moved client, API, Prisma schema, seed runner, env example, and test files into frontend/backend/database areas; updated root scripts and local setup documentation.
- Added Node 24 runtime pin and package engine ranges, generated frontend/backend npm lockfiles, and created the initial Prisma migration.
- Generated the Prisma client, applied the migration, and seeded demo data against a separate disposable PostgreSQL 18 database on port 5544; the existing project database directory was not used.
- Directed Prisma client generation into the backend package so the external schema does not cause duplicate root dependencies.
- Added cursor-based load-more controls for student lessons, tasks, challenges, points history, notices, and leaderboard; teacher rosters, reviews, content lists, classes; and admin schools, people, class rosters, and task choices. Teachers can select an assigned class.
- Added lesson and task edit forms for teachers and admins, with edit controls shown only where the API reports permission. Lesson/task APIs retain server-side author/admin authorization.
- Added teacher/admin quiz management with multi-question authoring, edit controls, optional unlimited attempts, and a server-side lock after any student attempt. Added paginated quiz listing and documented the API contract.

## Remaining work

- Confirm the official title/problem statement and approve age/consent, privacy, evidence retention, moderation, and leaderboard policies.
- Add broader migration/seed regression coverage and ensure deployment uses the checked-in migration history.
- Add and run API, database integration, authorization, upload, UI, accessibility, and production checks.
- Add challenge lifecycle editing and account recovery/retention workflows; improve summary-card counts where they currently show only an initial page preview.
- Configure and verify CI/deployment, backups, monitoring, and rollback before release.
- Review the dependency audit findings reported during backend installation (four high severity findings; Multer 1.x is deprecated).

No stakeholder approval, end-to-end verification, deployment, or impact outcome is claimed. See [Roadmap](07-Development-Roadmap.md), [Testing and Deployment](08-Testing-and-Deployment.md), and [README](../README.md).
