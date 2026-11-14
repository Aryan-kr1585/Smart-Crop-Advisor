# 2. Requirements and Features

The table below records expected behavior and implementation state as inspected on 2026-11-15. A code path is not proof of stakeholder approval or release readiness. Age/consent, school verification, evidence retention, and moderation need approval.

## Roles and access
| Role | Access boundary |
|---|---|
| Student | Own profile, learning, attempts, submissions, points, badges, permitted leaderboard data |
| Teacher / Eco-club Coordinator | Assigned school/classes and submissions within that scope |
| Admin | Platform administration with privileged actions audited |

Authorization must be checked server-side on every scoped operation. Hiding a client route is not access control.

## Feature requirements
| ID / feature | Role and workflow / expected behaviour | Validation and acceptance criteria | Dependencies | Status |
|---|---|---|---|---|
| F-01 Accounts | All roles register/login/logout and access appropriate pages | Validate email/password; unique account; role cannot be self-elevated; invalid credentials disclose no secrets | Users, JWT, bcrypt | PARTIAL — API and student UI; recovery absent |
| F-02 Profile | All roles view/edit permitted profile fields | Validate formats/length; school/role changes privileged; persisted updates visible | Users, RBAC | PARTIAL — self display name and admin edits |
| F-03 Schools/classes | Admin creates groups and assigns membership; teachers view authorized students | Prevent duplicate membership; cross-school access denied | Schools, Classes | PARTIAL — create/assign/list; editing and full class UI absent |
| F-04 Lessons | Student browses published lessons; teacher/admin drafts, edits, publishes | Required title/body; students see published content only; authorized editor succeeds | Lessons, API/UI | PARTIAL — list/read/create/edit API and teacher/admin edit UI; draft workflow is limited |
| F-05 Quizzes | Teacher authors; student attempts and sees result | Validate availability/attempt limit; score computed server-side; answers belong to quiz; edits cannot alter past attempts | Quiz, Question, Option, Attempt | PARTIAL — multi-question author/edit UI and attempt lock implemented; policy and coverage pending |
| F-06 Tasks/challenges | Teacher/admin defines activity; student participates | Validate dates, eligibility, required fields, duplicate policy; deadline behaviour clear | Task, Challenge | PARTIAL — task create/edit and challenge creation; challenge editing and lifecycle management limited |
| F-07 Submissions | Student submits text/optional image; teacher approves/rejects with reason | Check ownership, file limits, reviewer scope, legal status transitions; no duplicate award | Submission, uploads, ledger | PARTIAL — local upload and review; retention and production storage policy absent |
| F-08 Points/progress | Student views totals/history; system awards on approved events | Server-controlled, atomic, idempotent awards; total derived from ledger; retry cannot duplicate | Ledger, transactions | PARTIAL — ledger/summary flows; verification and reversal tooling absent |
| F-09 Badges/levels | System grants criteria-based achievements; student views them | Unique grant; criteria use trusted records; thresholds configurable | Badge, UserBadge | PARTIAL — criteria and awards exist; admin management limited |
| F-10 Leaderboard | Students see approved ranking; teachers monitor scoped progress | Hide private details; stable tie policy; scope enforced | Points, membership, privacy | PARTIAL — student board; policy and teacher view absent |
| F-11 Teacher review | Teacher reviews pending submissions and student progress | Only assigned class/school; decision recorded; point grant atomic | Submissions, RBAC | PARTIAL — queue and decisions; coverage pending |
| F-12 Admin | Manage users, schools/classes, content, badges/challenges, activity | Admin role required; validate references; audit sensitive changes | All core entities | PARTIAL — user/school/class management, lesson/task editing, badge/challenge creation; several edit flows absent |
| F-13 Notifications | Notify of review results, badges, challenges | User preference, delivery failures handled, no sensitive preview | Notifications/events | PARTIAL — in-app review/award notices; no preferences or delivery service |

This summary is an inspection, not test evidence. Cursor pagination now has load-more controls in the main student, teacher, and admin lists. Editing/management coverage and product policy decisions remain incomplete.

For each feature, the workflow, expected behaviour, validation, acceptance criterion, dependency, and status are summarized above; detailed flows and contracts appear in [UI/UX](06-UI-UX-Design.md) and [API](05-API-Documentation.md).

## Gamification decisions pending
| Mechanic | Proposed behaviour | Approval needed |
|---|---|---|
| Points | Award defined events through immutable ledger | Values, caps, reversals, duplicate policy |
| Badges | One grant per user/criteria | Criteria, retroactive grants, revocation |
| Levels | Derived from cumulative eligible points | Thresholds and reversals |
| Streaks | Consecutive qualifying periods | Qualifying event, timezone, grace period |
| Challenges | Dated activity with completion rules | Team scoring, moderation, tie resolution |
| Leaderboard | Rank within approved scope and period | Privacy, aliases, opt-out, score window |
| Notifications | In-app event notices | Preferences, retention, consent implications |

## Non-functional requirements
Security: bcrypt, managed JWT secrets, Zod validation, server-side authorization, safe uploads, least privilege. Privacy: minimize data and define student consent, retention, deletion, and visibility before release. Reliability: atomic/idempotent awards and submission transitions. Performance: paginate, index common queries, set measurable targets before launch. Accessibility: keyboard use, focus, semantic structure, labels, contrast, accessible feedback. Maintainability: separate frontend/backend/database areas, JavaScript-only, documented REST, Prisma migrations. Observability: safe structured logs without credentials or unnecessary student data.
