# 3. Technical Architecture

## Constraints and target stack
**JavaScript only:** backend files `.js` with ES Modules; React components `.jsx`; never create `.ts`/`.tsx`. Keep `client/` and `server/` separate. PostgreSQL is primary; Prisma handles data access and migrations. This is proposed; no implementation was found.

| Layer | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, JSX, React Router, TanStack Query, CSS Modules or regular CSS |
| Backend | Node.js, Express, JavaScript ES Modules, REST, JWT, bcrypt, Zod |
| Database | PostgreSQL, Prisma, Prisma migrations; Neon hosted target |
| Images | Cloudinary using signed/controlled upload |
| Deployment | Render API, Vercel client, GitHub, GitHub Actions |

## System communication
```mermaid
flowchart LR
  U[Student / Teacher / Admin browser] -->|HTTPS| V[Vercel: React client]
  V -->|JSON REST + JWT| R[Render: Express API]
  R -->|Prisma queries| N[(Neon PostgreSQL)]
  V -->|authorized image upload| C[Cloudinary]
  R -->|signed upload config / metadata| C
  G[GitHub] --> A[GitHub Actions]
  A --> V
  A --> R
```
Provider integrations are intended topology, not configured services.

## Frontend and backend structure
Frontend uses route-level pages/reusable components, isolated API services, React Router, and TanStack Query for server state. Forms provide UX validation; API validation is authoritative. Backend routes define contracts; middleware authenticates and authorizes; Zod validates params/query/body; domain services enforce rules and transactions; Prisma accesses data; centralized error middleware returns stable safe errors.

```mermaid
sequenceDiagram
  actor Student
  participant UI as React client
  participant API as Express API
  participant Auth as Auth and scope checks
  participant Svc as Domain service
  participant DB as PostgreSQL via Prisma
  Student->>UI: Submit action
  UI->>API: HTTPS JSON request + credential
  API->>Auth: Verify token, role, school/class
  Auth-->>API: Authorized identity or error
  API->>Svc: Validated request
  Svc->>DB: Read/write transaction if needed
  DB-->>Svc: Result
  Svc-->>API: Domain result
  API-->>UI: JSON and HTTP status
```

## Authentication, uploads, deployment
Use bcrypt; never store/log plaintext passwords. JWT secrets belong in environment-managed secret stores; define expiry, issuer/audience checks, refresh/revocation, and cookie versus bearer strategy before coding. Verify ownership and school/class scope server-side. The API alone accesses PostgreSQL. Store Cloudinary IDs and safe metadata, not binaries, in PostgreSQL; constrain file size/type and use signed or server-mediated uploads. Define evidence retention/deletion.

Vercel serves client; Render runs API; Neon hosts PostgreSQL; Cloudinary stores evidence. Separate environment credentials, CORS allowlists, HTTPS, health checks, backups, and reviewed migrations. GitHub Actions should run approved build/checks and deploy by environment policy.

## Recommended future layout
```text
client/src/{app,components,features,hooks,lib,pages,services,styles}
server/prisma/{schema.prisma,migrations,seed.js}
server/src/{config,middleware,modules,lib,app.js,server.js}
```
These are recommendations, not files created. See [Testing and Deployment](08-Testing-and-Deployment.md).
