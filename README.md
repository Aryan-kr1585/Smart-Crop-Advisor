# EcoQuest (provisional)

> **Project identity needs confirmation.** The repository is `Smart-Crop-Advisor`; the supplied title is “Smart Crop Advisory System for Small and Marginal Farmers,” while the supplied description and requested features describe environmental education for Indian students. This README documents the environmental education scope provisionally. Confirm the faculty-approved title/problem statement before implementation.

## Description
EcoQuest is a proposed platform to help school and college students learn about environmental issues through lessons, quizzes, real-world sustainability tasks, and school participation. Students may earn traceable eco-points and badges; teachers/coordinators may manage content and review submissions. These are goals, not measured impact claims.

## Problem and planned features
The proposed scope addresses the gap between theoretical environmental learning and practical participation. Planned features: student learning and progress; teacher-managed content and task review; admin management of users/schools/content; points ledger, badges, and approved-scope leaderboard; optional evidence-image upload subject to privacy decisions. **Not implemented.**

## Planned stack and architecture
React/Vite/JavaScript/JSX, React Router, TanStack Query, Express/Node.js JavaScript ES Modules, REST, JWT, bcrypt, Zod, PostgreSQL, Prisma, Cloudinary, Neon, Render, Vercel, GitHub, GitHub Actions. TypeScript is prohibited; client and server remain separate. React client communicates by HTTPS with Express; API validates/authorizes and accesses PostgreSQL via Prisma; Cloudinary stores approved images. See [Architecture](docs/03-Technical-Architecture.md).

## Structure
```text
.
├── docs/
│   ├── 01-Project-Overview.md
│   ├── 02-Requirements-and-Features.md
│   ├── 03-Technical-Architecture.md
│   ├── 04-Database-Design.md
│   ├── 05-API-Documentation.md
│   ├── 06-UI-UX-Design.md
│   ├── 07-Development-Roadmap.md
│   ├── 08-Testing-and-Deployment.md
│   └── 09-Project-Status.md
├── PROJECT_RULES.md
└── README.md
```
At inspection, no application files, manifests, or setup scripts existed. `client/` and `server/` were intentionally not created. Setup commands will be documented when supported by implementation.

## Documentation
- [Overview](docs/01-Project-Overview.md) · [Requirements](docs/02-Requirements-and-Features.md) · [Architecture](docs/03-Technical-Architecture.md)
- [Database](docs/04-Database-Design.md) · [API](docs/05-API-Documentation.md) · [UI/UX](docs/06-UI-UX-Design.md)
- [Roadmap](docs/07-Development-Roadmap.md) · [Testing and deployment](docs/08-Testing-and-Deployment.md) · [Status](docs/09-Project-Status.md)
- [Project rules](PROJECT_RULES.md)

## Status and future plans
**Documentation baseline created; application implementation NOT STARTED.** Title/problem statement needs confirmation. No frontend, backend, database, API, auth, tests, or deployment configuration existed at inspection. Confirm identity, review/approve docs, then follow the roadmap. See [Project Status](docs/09-Project-Status.md).
