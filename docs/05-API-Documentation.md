# 5. API Documentation

**All endpoints below are PROPOSED — NOT IMPLEMENTED.** Repository has no API code. Draft contracts need review.

## Conventions
Base `/api/v1`; HTTPS; JSON except upload negotiation; plural nouns, camelCase, ISO-8601 UTC, stable IDs. Zod validates params/query/body. Never trust client role, points, score, or ownership. Paginate lists with bounded `limit` and a cursor strategy to finalize. Proposed error: `{"error":{"code":"VALIDATION_ERROR","message":"Request could not be processed","details":[]}}`. Statuses: 200 read/update, 201 create, 204 empty success, 400 malformed, 401 unauthenticated, 403 forbidden, 404 unavailable/out of scope, 409 conflict, 422 semantic validation, 429 rate limited, 500 unexpected. Bearer JWT is draft; transport/refresh/CSRF decision pending.

## Endpoint catalogue
Each entry includes method, URL, purpose, auth/role, representative request/response, and common errors. **Status for every entry: NOT IMPLEMENTED.**
| Area | Method URL | Purpose; auth/role | Request → response example | Errors |
|---|---|---|---|---|
| Auth | POST `/auth/register` | Create account; public/policy pending | `{email,password,displayName}` → `{user:{id,email,role}}` | 400,409,422,429 |
| Auth | POST `/auth/login` | Authenticate; public | `{email,password}` → `{accessToken,expiresIn,user}` | 400,401,429 |
| Auth | POST `/auth/logout` | End session; authenticated | `{}` → `{success:true}` | 401 |
| Users | GET `/users/me` | Current profile; any auth | → `{id,displayName,role,schoolId}` | 401 |
| Users | PATCH `/users/me` | Edit permitted fields; any auth | `{displayName}` → profile | 401,422 |
| Users | GET `/users` | Search/manage; admin or scoped teacher | `?schoolId&classId&cursor&limit` → `{items,nextCursor}` | 401,403,422 |
| Schools | GET `/schools` | List; authenticated, scope applied | pagination → `{items,nextCursor}` | 401,403 |
| Schools | POST `/schools` | Create; admin | `{name}` → `{id,name}` | 401,403,409,422 |
| Schools | PATCH `/schools/:schoolId` | Update; admin | `{name,status}` → school | 401,403,404,422 |
| Classes | GET `/schools/:schoolId/classes` | List; admin/assigned teacher | pagination → `{items,nextCursor}` | 401,403,404 |
| Classes | POST `/schools/:schoolId/classes` | Create; admin | `{name,academicYear}` → class | 401,403,409,422 |
| Classes | POST `/classes/:classId/members` | Assign students; admin/scoped teacher | `{userIds:[]}` → `{added}` | 401,403,404,422 |
| Lessons | GET `/lessons` | Browse published; authenticated | pagination → `{items,nextCursor}` | 401,422 |
| Lessons | GET `/lessons/:lessonId` | Read; authenticated | → `{id,title,body}` | 401,404 |
| Lessons | POST `/lessons` | Create; teacher/admin | `{title,body,status}` → lesson | 401,403,422 |
| Lessons | PATCH `/lessons/:lessonId` | Edit; scoped author/admin | fields → lesson | 401,403,404,422 |
| Quizzes | GET `/quizzes/:quizId` | Read, omit answer key; auth | → `{id,title,questions:[]}` | 401,404 |
| Quizzes | POST `/quizzes` | Create; teacher/admin | `{title,questions:[]}` → quiz | 401,403,422 |
| Quizzes | POST `/quizzes/:quizId/attempts` | Submit attempt; student | `{answers:[]}` → `{attemptId,score}` | 401,403,404,409,422 |
| Quizzes | GET `/quizzes/:quizId/attempts/me` | Own attempts; student | → `{items:[]}` | 401,404 |
| Tasks | GET `/tasks` | Browse eligible; authenticated | filters/pagination → list | 401,422 |
| Tasks | POST `/tasks` | Create; teacher/admin | `{title,instructions,points,dueAt}` → task | 401,403,422 |
| Tasks | PATCH `/tasks/:taskId` | Edit; scoped author/admin | fields → task | 401,403,404,422 |
| Submissions | POST `/tasks/:taskId/submissions` | Submit; student | `{text?,assetId?}` → `{id,status}` | 401,403,404,409,422 |
| Submissions | GET `/submissions` | Review queue; scoped teacher/admin | filters/pagination → list | 401,403,422 |
| Submissions | POST `/submissions/:id/review` | Approve/reject; scoped teacher/admin | `{decision,reviewNote?}` → `{id,status,awardedPoints}` | 401,403,404,409,422 |
| Upload | POST `/uploads/signature` | Authorize upload; eligible student | `{fileName,mimeType,size}` → signed params | 401,403,422,429 |
| Points | GET `/users/me/points` | Own summary/history; student | pagination → `{total,entries,nextCursor}` | 401,422 |
| Points | GET `/users/:userId/points` | Scoped progress; teacher/admin | pagination → summary | 401,403,404 |
| Badges | GET `/badges` | Browse definitions; auth | → `{items:[]}` | 401 |
| Badges | GET `/users/me/badges` | Own awards; student | → `{items:[]}` | 401 |
| Badges | POST `/badges` | Create; admin | `{name,description,criteria}` → badge | 401,403,409,422 |
| Challenges | GET `/challenges` | Browse active; auth | filters/pagination → list | 401,422 |
| Challenges | POST `/challenges` | Create; teacher/admin | `{title,startsAt,endsAt,taskIds}` → challenge | 401,403,422 |
| Leaderboard | GET `/leaderboard` | View approved ranking; auth | `?schoolId&period&cursor&limit` → `{items:[{rank,displayName,points}]}` | 401,403,422 |
| Notifications | GET `/notifications` | Own notices; auth | `?unread&cursor&limit` → `{items,nextCursor}` | 401,422 |
| Notifications | PATCH `/notifications/:id/read` | Mark own read; auth | `{}` → `{id,readAt}` | 401,404 |

Do not expose password hashes, answer keys before submission, private student data, provider secrets, or another user's records. Use idempotency for awards/reviews. Update this contract when API changes.
