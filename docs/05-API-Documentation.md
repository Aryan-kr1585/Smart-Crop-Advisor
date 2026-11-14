# 5. API Documentation

**API implementation exists** under `backend/src/modules/`. The catalogue below describes intended routes but should be read with the route code as authority; the implementation and table are not yet fully reconciled. Upload config/local retrieval and some response details are omitted from this catalogue.

## Conventions
Base `/api/v1`; HTTPS; JSON except upload negotiation; plural nouns, camelCase, ISO-8601 UTC, stable IDs. Zod validates params/query/body. Never trust client role, points, score, or ownership. Paginate lists with bounded `limit` and a cursor strategy to finalize. Proposed error: `{"error":{"code":"VALIDATION_ERROR","message":"Request could not be processed","details":[]}}`. Statuses: 200 read/update, 201 create, 204 empty success, 400 malformed, 401 unauthenticated, 403 forbidden, 404 unavailable/out of scope, 409 conflict, 422 semantic validation, 429 rate limited, 500 unexpected. Bearer JWT is draft; transport/refresh/CSRF decision pending.

## Endpoint catalogue
Each entry includes method, URL, purpose, auth/role, representative request/response, and common errors. Most catalogued routes are implemented; see the modules for exact request/response shapes and validation.
| Area | Method URL | Purpose; auth/role | Request → response example | Errors |
|---|---|---|---|---|
| Auth | POST `/auth/register` | Create account; public/policy pending | `{email,password,displayName}` → `{user:{id,email,role}}` | 400,409,422,429 |
| Auth | POST `/auth/login` | Authenticate; public | `{email,password}` → `{accessToken,expiresIn,user}` | 400,401,429 |
| Auth | POST `/auth/logout` | End session; authenticated | `{}` → `{success:true}` | 401 |
| Auth | POST `/auth/password-reset-requests` | Request recovery; public, generic response | `{email}` → `{success:true,message}`; dev also returns a local link | 422,429 |
| Auth | POST `/auth/password-resets` | Set password with one-time token; public | `{token,password}` → `{success:true,message}` | 400,422,429 |
| Users | GET `/users/me` | Current profile; any auth | → `{id,displayName,role,schoolId}` | 401 |
| Users | GET `/users/me/export` | Download own profile and activity data; any auth | → JSON attachment; `Cache-Control: no-store` | 401 |
| Users | PATCH `/users/me` | Edit permitted fields; any auth | `{displayName}` → profile | 401,422 |
| Users | DELETE `/users/me` | Request anonymizing deletion; any auth | `{confirmation:"DELETE MY ACCOUNT"}` → `{success:true}` | 401,409,422,503 |
| Users | GET `/users` | Search/manage; admin or scoped teacher | `?schoolId&classId&cursor&limit` → `{items,nextCursor}` | 401,403,422 |
| Schools | GET `/schools` | List; authenticated, scope applied | pagination → `{items,nextCursor}` | 401,403 |
| Schools | POST `/schools` | Create; admin | `{name}` → `{id,name}` | 401,403,409,422 |
| Schools | PATCH `/schools/:schoolId` | Update; admin | `{name,status}` → school | 401,403,404,422 |
| Classes | GET `/schools/:schoolId/classes` | List; admin/assigned teacher | pagination → `{items,nextCursor}` | 401,403,404 |
| Classes | POST `/schools/:schoolId/classes` | Create; admin | `{name,academicYear}` → class | 401,403,409,422 |
| Classes | PATCH `/classes/:classId` | Edit name/year; admin | `{name?,academicYear?}` → class | 401,403,404,409,422 |
| Classes | POST `/classes/:classId/members` | Assign students; admin/scoped teacher | `{userIds:[]}` → `{added}` | 401,403,404,422 |
| Lessons | GET `/lessons` | Browse available lessons; authenticated | pagination → `{items:[{id,title,status,authorId,canEdit}],nextCursor,totalCount}` | 401,422 |
| Lessons | GET `/lessons/:lessonId` | Read; authenticated | → `{id,title,body}` | 401,404 |
| Lessons | POST `/lessons` | Create; teacher/admin | `{title,body,status}` → lesson | 401,403,422 |
| Lessons | PATCH `/lessons/:lessonId` | Edit; scoped author/admin | fields → lesson | 401,403,404,422 |
| Quizzes | GET `/quizzes` | List/manage quizzes; teacher/admin | `?cursor&limit` → `{items:[{id,title,status,questionsCount,attemptsCount,canEdit}],nextCursor}` | 401,403,422 |
| Quizzes | GET `/quizzes/:quizId` | Read quiz; students omit answer key, teachers/admins see it | → `{id,title,questions:[]}` | 401,404 |
| Quizzes | POST `/quizzes` | Create; teacher/admin | `{title,questions:[]}` → quiz | 401,403,422 |
| Quizzes | PATCH `/quizzes/:quizId` | Edit quiz before any attempt; author/admin | quiz fields; optional full question replacement → quiz | 401,403,404,409,422 |
| Quizzes | POST `/quizzes/:quizId/attempts` | Submit attempt; student | `{answers:[]}` → `{attemptId,score}` | 401,403,404,409,422 |
| Quizzes | GET `/quizzes/:quizId/attempts/me` | Own attempts; student | → `{items:[]}` | 401,404 |
| Tasks | GET `/tasks` | Browse available tasks; authenticated | pagination → `{items:[{id,title,instructions,status,points,startsAt,dueAt,requiresReview,canEdit}],nextCursor,totalCount}`; students also receive `openCount` (not approved and not past due) | 401,422 |
| Tasks | POST `/tasks` | Create; teacher/admin | `{title,instructions,points,dueAt}` → task | 401,403,422 |
| Tasks | PATCH `/tasks/:taskId` | Edit; scoped author/admin | fields → task | 401,403,404,422 |
| Submissions | POST `/tasks/:taskId/submissions` | Submit; student | `{text?,assetId?}` → `{id,status}` | 401,403,404,409,422 |
| Submissions | GET `/submissions` | Review queue; scoped teacher/admin | filters/pagination → `{items,nextCursor,totalCount}` | 401,403,422 |
| Submissions | POST `/submissions/:id/review` | Approve/reject; scoped teacher/admin | `{decision,reviewNote?}` → `{id,status,awardedPoints}` | 401,403,404,409,422 |
| Upload | POST `/uploads/signature` | Authorize upload; eligible student | `{fileName,mimeType,size}` → signed params | 401,403,422,429 |
| Points | GET `/users/me/points` | Own summary/history; student | pagination → `{total,entries,nextCursor}` | 401,422 |
| Points | GET `/users/:userId/points` | Scoped progress; teacher/admin | pagination → summary | 401,403,404 |
| Badges | GET `/badges` | Browse definitions; auth | → `{items:[]}` | 401 |
| Badges | GET `/users/me/badges` | Own awards; student | → `{items:[]}` | 401 |
| Badges | POST `/badges` | Create; admin | `{name,description,criteria}` → badge | 401,403,409,422 |
| Challenges | GET `/challenges` | Browse active (students) or manage all (staff); auth | `?cursor&limit` → `{items:[{id,title,status,startsAt,endsAt,tasks}],nextCursor}` | 401,422 |
| Challenges | POST `/challenges` | Create; teacher/admin | `{title,description,startsAt,endsAt,status,schoolId,taskIds}` → challenge | 401,403,404,422 |
| Challenges | PATCH `/challenges/:challengeId` | Edit lifecycle and content; admin | partial fields, optional task replacement → challenge | 401,403,404,422 |
| Leaderboard | GET `/leaderboard` | View approved ranking; auth | `?schoolId&period&cursor&limit` → `{items:[{rank,displayName,points}]}` | 401,403,422 |
| Notifications | GET `/notifications` | Own notices; auth | `?unread&cursor&limit` → `{items,nextCursor}` | 401,422 |
| Notifications | PATCH `/notifications/:id/read` | Mark own read; auth | `{}` → `{id,readAt}` | 401,404 |

Do not expose password hashes, reset-token hashes, answer keys before submission, private student data, provider secrets, or another user's records. Password reset tokens expire after 30 minutes, work once, and invalidate prior sessions; only development responses include the raw local reset link. Account deletion removes direct identifiers, authored-content attribution, and uploaded evidence but retains pseudonymous quiz, point-ledger, and audit history; retention duration and backup expiry remain policy decisions. Quiz edits are rejected after the first attempt to preserve recorded score meaning. Use idempotency for awards/reviews. Update this contract when API changes.
