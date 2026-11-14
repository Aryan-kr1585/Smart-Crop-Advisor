# 7. Development Roadmap

Roadmap state reflects the repository as inspected on 2026-11-15. Statuses describe code artifacts, not stakeholder acceptance or production readiness. The official project identity remains unresolved.

## Phase 0 – Scope and setup
- **Status: IN PROGRESS / NEEDS CONFIRMATION.** The provisional EcoQuest implementation exists, but the repository and supplied title say Smart Crop Advisor. Obtain an authoritative title/problem statement before presenting or deploying.
- **Completed in this pass:** Node 24 is pinned in `.nvmrc` and package engine fields; frontend/backend lockfiles are checked in; root setup uses `npm ci`.

## Phase 1 – Data model and persistence
- **Status: IMPLEMENTED; FRESH DATABASE VERIFIED.** Prisma models cover schools/classes, users, lessons/quizzes, tasks/submissions, uploads, points, badges, challenges, notifications, and audit records. Initial migration is checked in under `database/prisma/migrations`.
- `npm run setup` invokes Prisma using `database/prisma/schema.prisma` and then the backend seed runner. The migration was generated, applied, and seeded against a disposable PostgreSQL 18 database. User export and anonymizing deletion are implemented; retention and backup expiry policy remain open.

## Phase 2 – API foundation and authentication
- **Status: IMPLEMENTED; VERIFICATION PENDING.** Express app, validated env, Prisma client, safe errors, JWT auth/revocation, bcrypt, RBAC, rate limits, Helmet, CORS, health endpoint, and single-use password recovery are present. Production recovery requires Resend configuration.
- Add automated API/auth/scope coverage and define a production token/storage policy.

## Phase 3 – Core API workflows
- **Status: MVP IMPLEMENTED; VERIFICATION AND COVERAGE PENDING.** API routes cover schools/classes, lessons, quizzes, tasks/submissions/reviews, progress, badges, challenges, leaderboard, notices, and uploads. Award writes use a ledger and idempotency keys.
- Lesson and task edit forms now use existing API permission checks. API authorization/transaction behavior still needs release-grade verification.

## Phase 4 – Role-based client
- **Status: MVP IMPLEMENTED; POLISH PENDING.** React/Vite has public, student, teacher, and admin routes for learning, activities, progress, content authoring, reviews, and school/account setup. Cursor-backed lists now expose load-more controls, and teachers can select among assigned classes.
- Teachers and admins can author/edit quizzes with 1–20 questions and configure attempt limits. Quiz changes are locked after the first attempt. Admins can edit challenge dates, status, school scope, details, and linked tasks; class editing remains limited.
- Dashboard lesson, actionable-task, and pending-review counts use server totals rather than the first page preview.

## Phase 5 – Integrated journeys
- **Status: IMPLEMENTED IN CODE; NOT VERIFIED END TO END.** Client calls the API for registration/login, learning, quiz attempts, submissions/evidence, review, awards, and notices.
- Add integration coverage for full journeys, error/retry states, authorization boundaries, and concurrent review/attempt behavior.

## Phase 6 – Engagement and accessibility
- **Status: PARTIAL.** Points, levels, streaks, badges, challenges, leaderboard, user export, and account anonymization are implemented. Review semantic/keyboard/screen-reader behavior and approve ranking, scoring, consent, language, and retention policy.

## Phase 7 – Release quality and security
- **Status: NOT COMPLETE.** One scoring test exists; schema validation and a frontend production build passed, but the test suite was not run. Backend install reported four high severity dependency findings, including a Multer 1.x deprecation. Add API/integration/authz/upload/UI coverage, review dependency findings, and complete privacy/accessibility checks with synthetic data.

## Phase 8 – Deployment and presentation
- **Status: NOT STARTED.** No CI workflow, production config, or deployed service is present. Requires scope approval, migration review, accounts/secrets, backup/restore procedure, release checks, and rollback ownership.

See [Project Status](09-Project-Status.md) and [Testing and Deployment](08-Testing-and-Deployment.md).
