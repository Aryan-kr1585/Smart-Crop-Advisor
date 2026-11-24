# 9. Project Status

**Inspection date:** 2026-11-24 (Asia/Kolkata)

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
| Uploads | Local API disk path by default; optional Cloudinary signing/retrieval support; account deletion removes owned evidence; routine retention and consent policy unresolved |
| Verification | Frontend build and all four backend tests passed; Prisma schema validation passed; four migrations applied to the verified-empty local PostgreSQL database; live API health returned 200 and the protected activity endpoint returned 401 without a token. Demo seed and full authenticated browser journey not run |
| Deployment | GitHub Actions validation/build workflow added; hosted execution not yet observed; no production deployment configuration |
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
- Added an admin challenge manager for dates, status, school scope, details, and linked tasks, with server-side validation and audit logging.
- Added single-use, 30-minute password recovery tokens, password reset UI, rate limiting, session revocation, development reset links, and a production Resend delivery adapter.
- Added authenticated JSON data export and typed-confirmation account erasure. Erasure removes direct identifiers, authored-content attribution, and user evidence while retaining anonymized score/ledger/audit relationships; media objects are removed from local or Cloudinary storage.
- Added server-side totals for lesson catalogs, actionable student tasks, and scoped pending reviews so dashboard summary counts cover every page.
- Added an admin class edit endpoint and inline controls for class names and academic years, with uniqueness handling and audit records.
- Added paginated class rosters, idempotent member-add feedback, and audited admin member removal using inactive membership history.
- Added an admin badge manager for name/description updates, activation control, and pre-award criteria edits; criteria changes are locked once awards exist and updates are audited.
- Added a draft-or-active choice when admins create challenges, so they can prepare scheduled activities before students can see them.
- Added class-scoped teacher views of student point totals, levels, and paginated point histories; reviews invalidate open progress views.
- Added a per-user in-app notification opt-out and applied it to review, points-awarded, and badge-earned notices. Existing notices are retained.
- Added task start-date controls at creation/edit time, student availability messaging, and server-side validation that due dates follow start dates.
- Added a paginated class-scoped teacher points ranking with a stable points/name tie order and server-side class membership authorization.
- Added admin point-award reversals through one-time compensating ledger entries, with a required reason, idempotency key, and audit record.
- Added inline admin school name/region editing and audited school update transactions.
- Added a GitHub Actions workflow for lockfile installation, Prisma schema validation, backend syntax checks, and frontend build.
- Added draft-or-publish choices when teachers create lessons and tasks, with status-specific feedback and management lists for both states.

## Remaining work

- Confirm the official title/problem statement and approve age/consent, privacy, evidence retention, moderation, and leaderboard policies.
- Add broader migration/seed regression coverage and ensure deployment uses the checked-in migration history.
- Add and run API, database integration, authorization, upload, UI, accessibility, and production checks.
- Approve routine evidence retention, pseudonymous history retention, and backup expiry periods.
- Verify hosted CI runs; configure deployment, backups, monitoring, and rollback before release.
- Plan major Prisma 7 and React Router 7 upgrades to clear remaining advisory findings; review the deprecated Multer 1.x dependency before production.
- Run verification under the repository-pinned Node 24 runtime and add API/database/UI coverage for the interactive activities.

No stakeholder approval, end-to-end verification, deployment, or impact outcome is claimed. See [Roadmap](07-Development-Roadmap.md), [Testing and Deployment](08-Testing-and-Deployment.md), and [README](../README.md).
## Interactive learning activities (2026-11-24)
- Added garden exploration with three viewpoints and clickable soil, sunlight, and water features; garden sorting with corrective feedback; a keyboard/touch cleanup game; and a small tabular Q-learning demonstration.
- Added authenticated student completion tracking, a Prisma model/migration, and completion data to account export. Completion does not award eco-points.
- These activities are browser-based prototypes in the existing React application, not Unity scenes. Production database migration and device/accessibility review remain outstanding.
- Verification for this change: frontend production build passed; all four backend tests passed; Prisma schema validation and modified backend syntax checks passed. The activity migration and preceding checked-in migrations were applied to the verified-empty local development database. Live health returned 200; unauthenticated activity progress returned 401. API and database processes were stopped after the checks.
- Hardened completion writes with a per-IP request limit and capped quiz answer arrays at the maximum supported 20 questions. Upgraded Zod to 4.6.7 to address its high-severity constrained-collection memory advisory; existing tests and build still pass.
- Dependency audit still reports four high-severity issues through Prisma 6.19.3 CLI/config dependencies (fixed by Prisma 7, a breaking upgrade) and two moderate React Router advisories (fixed by React Router 7, a breaking upgrade). The current frontend uses client-side routing only and internal/static navigation destinations; no SSR hydration code or user-supplied route destination was found. Review and plan these major dependency upgrades before production.
- The installed runtime is Node 26.13.1, while the repository targets Node 24. Checks passed under Node 26; supported-runtime verification under Node 24 remains outstanding.
- The Node `--watch` development script hit `EMFILE` in this environment. Running the API directly worked; use Node 24 for follow-up development-runtime checks.
- The project identity remains unresolved: repository title says Smart Crop Advisor while the implemented product is provisional EcoQuest.
