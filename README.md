# EcoQuest (provisional)

EcoQuest is a web MVP for environmental learning and student activities. The repository name and supplied project title refer to crop advisory, while the implementation is an environmental education platform. The official title/problem statement still needs confirmation; this repository does not implement crop recommendations.

## Current implementation

- React 18, Vite, React Router, and TanStack Query client with student, teacher, and admin areas.
- Express REST API with Zod validation, JWT authentication, bcrypt password hashing, role checks, and Prisma/PostgreSQL persistence.
- Lessons and quizzes; tasks, submissions and review; points ledger, badges, challenges, leaderboard, notices; schools/classes and account administration.
- JPEG, PNG, and WebP evidence uploads up to 5 MB. Local disk storage is the default; Cloudinary signing is available when configured.
- Demo seed data and a scoring unit test. Production privacy/consent, deployment, and crop-advisor scope are not approved.

## Repository layout

```text
.
├── frontend/                 # React/Vite browser application
├── backend/                  # Express API, runtime config, and API tests
│   └── scripts/db/            # Database seed runner
├── database/                 # Prisma schema and migration history
│   └── prisma/
├── docs/                     # Project and engineering documentation
└── package.json              # Root commands for local development
```

## Run locally

Requirements: Node.js 24 and npm, plus a reachable PostgreSQL database. The repository pins Node 24 in `.nvmrc` and package engine metadata. Configure `DATABASE_URL` for a **development-only** database. From this directory:

```sh
cp backend/.env.example backend/.env
# Set a private JWT_SECRET of at least 32 characters and the local DATABASE_URL.
npm run setup
npm run dev:api
```

In another terminal, run `npm run dev:web`. Vite proxies `/api` to `http://127.0.0.1:4000`. `npm run setup` uses the checked-in lockfiles to install both app packages, applies the checked-in Prisma migration, and seeds demo records. The optional `npm run db:start` script is specific to a local PostgreSQL 18 installation on macOS and is not required when PostgreSQL is already running.

The development seed creates `admin@ecoquest.test`, `teacher@ecoquest.test`, `student@ecoquest.test`, and `student2@ecoquest.test`, all with password `EcoQuest123!`. These credentials are for local development only; do not expose a seeded instance publicly.

Use `npm run build:web` to create the client production build. `npm test` runs the backend Node test suite. `npm run db:migrate` applies/creates development migrations; `npm run db:seed` loads the synthetic demo records.

## Project documentation

- [Overview](docs/01-Project-Overview.md) · [Requirements](docs/02-Requirements-and-Features.md) · [Architecture](docs/03-Technical-Architecture.md)
- [Database](docs/04-Database-Design.md) · [API](docs/05-API-Documentation.md) · [UI/UX](docs/06-UI-UX-Design.md)
- [Roadmap](docs/07-Development-Roadmap.md) · [Testing and deployment](docs/08-Testing-and-Deployment.md) · [Status](docs/09-Project-Status.md)
- [Project rules](PROJECT_RULES.md)

## Known limits

The current UI uses the first available class for teacher roster display, and admin/teacher list screens use the first API page. There is no CI workflow, production deployment config, password recovery, or student privacy/consent workflow. Read [Project Status](docs/09-Project-Status.md) before treating this MVP as release-ready.
