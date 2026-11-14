# 7. Development Roadmap

Roadmap state reflects the repository as inspected on 2026-11-14. Statuses describe code artifacts, not stakeholder acceptance or production readiness. The official project identity remains unresolved.

## Phase 0 – Scope and setup
- **Status: IN PROGRESS / NEEDS CONFIRMATION.** The provisional EcoQuest implementation exists, but the repository and supplied title say Smart Crop Advisor. Obtain an authoritative title/problem statement before presenting or deploying.
- The JS frontend/backend manifests, backend env example, seed runner, and root scripts exist. A Node version, lockfiles, and checked-in Prisma migration are still absent.

## Phase 1 – Data model and persistence
- **Status: IMPLEMENTED IN SOURCE; MIGRATION PENDING.** Prisma models cover schools/classes, users, lessons/quizzes, tasks/submissions, uploads, points, badges, challenges, notifications, and audit records.
- `npm run setup` invokes Prisma using `database/prisma/schema.prisma` and then the backend seed runner. Generate and review a migration from a disposable development database, then commit it before shared deployment. Privacy/retention policy remains open.

## Phase 2 – API foundation and authentication
- **Status: IMPLEMENTED; VERIFICATION PENDING.** Express app, validated env, Prisma client, safe errors, JWT auth/revocation, bcrypt, RBAC, rate limits, Helmet, CORS, and health endpoint are present.
- Add automated API/auth/scope coverage and define a production token/storage policy.

## Phase 3 – Core API workflows
- **Status: MVP IMPLEMENTED; VERIFICATION AND COVERAGE PENDING.** API routes cover schools/classes, lessons, quizzes, tasks/submissions/reviews, progress, badges, challenges, leaderboard, notices, and uploads. Award writes use a ledger and idempotency keys.
- Known limits include lack of a full edit workflow in the UI, migration history, and release-grade authorization/transaction verification.

## Phase 4 – Role-based client
- **Status: MVP IMPLEMENTED; POLISH PENDING.** React/Vite has public, student, teacher, and admin routes for learning, activities, progress, content authoring, reviews, and school/account setup.
- Some screens display only the first page/class. Quiz authoring currently creates a single-question quiz; admin content management is limited.

## Phase 5 – Integrated journeys
- **Status: IMPLEMENTED IN CODE; NOT VERIFIED END TO END.** Client calls the API for registration/login, learning, quiz attempts, submissions/evidence, review, awards, and notices.
- Add integration coverage for full journeys, error/retry states, authorization boundaries, and concurrent review/attempt behavior.

## Phase 6 – Engagement and accessibility
- **Status: PARTIAL.** Points, levels, streaks, badges, challenges, and leaderboard are implemented. Review semantic/keyboard/screen-reader behavior and approve ranking, scoring, consent, language, and retention policy.

## Phase 7 – Release quality and security
- **Status: NOT COMPLETE.** One scoring test exists; no checks were run for this pass. Add unit/API/integration/authz/upload/UI coverage, dependency review, and privacy/accessibility checks with synthetic data.

## Phase 8 – Deployment and presentation
- **Status: NOT STARTED.** No CI workflow, production config, or deployed service is present. Requires scope approval, migration review, accounts/secrets, backup/restore procedure, release checks, and rollback ownership.

See [Project Status](09-Project-Status.md) and [Testing and Deployment](08-Testing-and-Deployment.md).
