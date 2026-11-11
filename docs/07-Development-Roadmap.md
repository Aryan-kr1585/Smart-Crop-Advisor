# 7. Development Roadmap

All phases are **NOT STARTED**. Resolve the title/scope discrepancy before product implementation. Each phase includes objective, tasks, dependencies, output, future modules, verification, and exit criteria.

## Phase 0 – Requirements and Project Setup
- [ ] Objective: agree on identity, user stories, MVP, and workflow.
- [ ] Tasks: confirm title/problem statement; finalize stories, privacy/consent, MVP; GitHub/branch plan; approve wireframes.
- [ ] Dependencies: faculty/project owner and team decisions.
- [ ] Output: approved scope/backlog/design. Future modules: repository setup only after approval.
- [ ] Verification: acceptance-criteria review and prototype/accessibility review.
- [ ] Complete when stakeholders approve one consistent scope and design.
- **Status: NEEDS CONFIRMATION**

## Phase 1 – Database Design
- [ ] Objective: finalize relational model.
- [ ] Tasks: ERD, Prisma schema, PostgreSQL config, migrations, safe seed data.
- [ ] Dependencies: Phase 0; retention/membership decisions.
- [ ] Output: reviewed schema, initial migration and seed plan. Future files: `server/prisma/schema.prisma`, migrations, `seed.js`.
- [ ] Verification: fresh migration and repeatable seed in disposable DB.
- [ ] Complete when schema is approved and fresh DB builds from migrations.
- **Status: NOT STARTED**

## Phase 2 – Backend Setup and Authentication
- [ ] Objective: secure Express foundation.
- [ ] Tasks: Express, env validation, Prisma, errors/logging, registration/login, bcrypt, JWT, RBAC.
- [ ] Dependencies: Phase 1; auth policy.
- [ ] Output: runnable API and protected routes. Future modules: `server/src/app.js`, `server.js`, config, middleware, auth.
- [ ] Verification: validation, hash/token expiry, unauthorized/cross-scope tests.
- [ ] Complete when all protected operations enforce server authorization.
- **Status: NOT STARTED**

## Phase 3 – Backend Core APIs
- [ ] Objective: validated domain services and REST contracts.
- [ ] Tasks: lessons, quizzes, tasks, submissions, ledger, badges, leaderboard, pagination/errors/idempotency.
- [ ] Dependencies: Phase 2 and approved rules/contracts.
- [ ] Output: MVP API. Future modules: server routes/controllers/services by domain.
- [ ] Verification: API/service tests, scoring, duplicate awards, scope/state transitions.
- [ ] Complete when documented endpoint criteria pass and contracts are current.
- **Status: NOT STARTED**

## Phase 4 – React Frontend
- [ ] Objective: accessible client shell and role experiences.
- [ ] Tasks: Vite, routing/query, auth, student/teacher dashboards, lessons, quizzes, tasks, leaderboard.
- [ ] Dependencies: wireframes/API contracts.
- [ ] Output: responsive client. Future modules: `client/src` pages/features/components/services; JSX components.
- [ ] Verification: route/component, keyboard/accessibility, responsive review.
- [ ] Complete when approved wireframes are implemented without false capability claims.
- **Status: NOT STARTED**

## Phase 5 – Frontend and Backend Integration
- [ ] Objective: end-to-end learning and review workflows.
- [ ] Tasks: API integration, protected routes, forms, uploads, approval, error/retry handling.
- [ ] Dependencies: Phases 3/4 and upload/privacy policy.
- [ ] Output: integrated MVP. Future modules: client query/services/upload flow.
- [ ] Verification: journey from login through task review/points; scope/error cases.
- [ ] Complete when representative full journeys pass.
- **Status: NOT STARTED**

## Phase 6 – Gamification and UI Polish
- [ ] Objective: add approved engagement mechanics.
- [ ] Tasks: levels, streaks, badge unlocks, weekly challenges, notices, animation, approved languages.
- [ ] Dependencies: core event model and approved rules.
- [ ] Output: tested mechanics. Future modules: gamification/notification/localization.
- [ ] Verification: criteria, timezones, duplicate grants, preferences/accessibility.
- [ ] Complete when rules are documented and events verified.
- **Status: NOT STARTED**

## Phase 7 – Testing and Security
- [ ] Objective: validate release quality/privacy/performance.
- [ ] Tasks: unit, API, integration, authorization, upload security, performance, Lighthouse; fix findings.
- [ ] Dependencies: integrated product and approved targets.
- [ ] Output: evidence and release review. Future modules: test suites and CI checks.
- [ ] Verification: see [Testing and Deployment](08-Testing-and-Deployment.md).
- [ ] Complete when thresholds pass with no unresolved critical issue.
- **Status: NOT STARTED**

## Phase 8 – Deployment and Presentation
- [ ] Objective: deploy verified product and prepare demo.
- [ ] Tasks: Neon, Render, Vercel, secrets, Actions, production verification, README/diagram, demo.
- [ ] Dependencies: Phase 7; accounts, release procedure.
- [ ] Output: documented deployment and presentation. Future modules: deployment workflows/configuration.
- [ ] Verification: smoke checks, migration, health, backup/restore.
- [ ] Complete when production checklist passes and rollback ownership is clear.
- **Status: NOT STARTED**
