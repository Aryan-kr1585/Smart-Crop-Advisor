# 4. Database Design

**Implemented schema:** `database/prisma/schema.prisma` defines the PostgreSQL model, `database/prisma/migrations/` contains the initial migration, and `backend/scripts/db/seed.js` supplies synthetic development records. The initial migration was applied and the seed completed against a disposable local PostgreSQL 18 database. Confirm privacy, retention, membership, and scoring policies before production.

## ER diagram
```mermaid
erDiagram
  SCHOOL ||--o{ CLASS : contains
  SCHOOL ||--o{ USER : affiliates
  CLASS }o--o{ USER : enrolls
  USER ||--o{ QUIZ_ATTEMPT : makes
  QUIZ ||--o{ QUESTION : contains
  QUESTION ||--o{ OPTION : offers
  QUIZ ||--o{ QUIZ_ATTEMPT : receives
  USER ||--o{ SUBMISSION : creates
  TASK ||--o{ SUBMISSION : receives
  USER ||--o{ POINT_LEDGER : earns
  USER ||--o{ USER_BADGE : receives
  BADGE ||--o{ USER_BADGE : grants
  USER ||--o{ NOTIFICATION : receives
  CHALLENGE }o--o{ TASK : includes
  USER ||--o{ LESSON : authors
  USER ||--o{ QUIZ : authors
  USER ||--o{ TASK : authors
```
Many-to-many links should be explicit `ClassMembership`, `UserBadge`, and `ChallengeTask` tables where metadata/constraints are needed.

## Proposed relational tables
IDs are PostgreSQL UUIDs; mutable records generally have `createdAt`/`updatedAt`, events have `createdAt`.
| Table | Purpose and columns | Keys, relationships, constraints, indexes |
|---|---|---|
| User | Identity: `id,email,passwordHash,displayName,role,status,schoolId?` | PK id; FK School; unique normalized email; index `(schoolId,role,status)`; never plaintext password |
| PasswordResetToken | Recovery: `tokenHash,userId,expiresAt,usedAt,createdAt` | Unique token hash; FK User with cascade; index `(userId,expiresAt)`; raw token is never persisted |
| School | Tenant: `id,name,region?,status` | PK; decide unique code/name; index status/region |
| Class | Group: `id,schoolId,name,academicYear?` | PK; FK School; unique `(schoolId,name,academicYear)`; index schoolId |
| ClassMembership | User/class join: `userId,classId,joinedAt,status` | Composite PK; FKs; indexes both FKs; enforce school consistency |
| Lesson | Content: `id,title,body,status,authorId?,publishedAt?` | PK; FK author; index `(status,publishedAt)` |
| Quiz | Quiz: `id,lessonId?,title,status,attemptLimit?,authorId?` | PK; FKs; indexes lessonId/status |
| Question | Prompt: `id,quizId,prompt,type,position,points` | PK; FK Quiz; unique `(quizId,position)`; index quizId |
| Option | Choice: `id,questionId,label,position,isCorrect` | PK; FK Question; unique `(questionId,position)`; restrict answer-key serialization |
| QuizAttempt | Result: `id,userId,quizId,score,submittedAt,answers?` | PK; FKs; indexes `(userId,quizId,submittedAt)` and quiz/time |
| Task | Activity: `id,title,instructions,status,points,authorId?,startsAt?,dueAt?,requiresReview` | PK; FK author; nonnegative points/date checks; index status/dueAt |
| Submission | Evidence: `id,taskId,userId,status,text?,assetId?,reviewerId?,reviewedAt?,reviewNote?` | PK; FKs; unique active task/user per approved resubmission rule; indexes status/task/time and user/time |
| PointLedger | Auditable award/reversal: `id,userId,amount,reason,sourceType,sourceId,idempotencyKey` | PK; FK User; unique idempotencyKey; indexes user/time and source; immutable entries |
| Badge | Definition: `id,name,description,criteria,active` | PK; unique name; index active |
| UserBadge | Award join: `userId,badgeId,earnedAt,source?` | Composite PK; FKs; index badge/time |
| Challenge | Campaign: `id,title,description,startsAt,endsAt,status,schoolId?` | PK; optional FK School; ends after starts; index status/date and school |
| ChallengeTask | Challenge/task join: `challengeId,taskId` | Composite PK; FKs; index taskId |
| Notification | In-app notice: `id,userId,type,payload,readAt?,createdAt` | PK; FK User; index `(userId,readAt,createdAt)` |

## Relationships, constraints, operation
One-to-many: School→Classes/Users, Quiz→Questions/Attempts, Question→Options, User→Attempts/Submissions/Ledger/Notifications, Task→Submissions. Many-to-many: Users↔Classes, Users↔Badges, Challenges↔Tasks through joins. No required one-to-one relation; if preferences split out, unique User FK enforces it.

Use non-null, FK, enum/check constraints; normalized email uniqueness; restrictive deletes for point history; archive policy for content/student records. Account erasure anonymizes and suspends the User row so audit, score, and ledger relations remain intact; direct identifiers, memberships, notices, badge grants, submission text, authored-content attribution, and uploaded evidence are removed. The exact retention period for pseudonymous history and backups still needs policy approval. Index common scope, published-content, pending-review, and user-history queries; avoid speculative indexes. Leaderboard derives from eligible ledger records until measured scale requires an aggregate. Submission approval + status + ledger award + badge evaluation must be atomic or idempotent. Quiz attempt and score persist in one transaction. Reverse points with compensating entries. Seed repeatable demo-only schools/content/badges and explicitly development-only accounts; never real student data. See [Architecture](03-Technical-Architecture.md).
