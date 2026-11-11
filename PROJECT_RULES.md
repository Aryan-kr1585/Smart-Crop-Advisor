# Project Rules

The repository is named `Smart-Crop-Advisor`, but the proposed EcoQuest scope conflicts with the supplied crop-advisory title. Official identity is **NEEDS CONFIRMATION**; see [Project Status](docs/09-Project-Status.md).

## Mandatory rules
1. Read `PROJECT_RULES.md` before any task.
2. Read relevant `docs/` material before implementing a feature.
3. Follow the approved technology stack.
4. Never use TypeScript or create `.ts`/`.tsx` files.
5. Backend uses JavaScript `.js` and ES Modules.
6. React components use JSX `.jsx`.
7. Use PostgreSQL and Prisma ORM/migrations.
8. Keep frontend/backend separate; follow documented architecture.
9. Never invent existing functionality.
10. Inspect code and Git state before modifying.
11. Work phase by phase.
12. Implement small, testable tasks.
13. Do not unnecessarily rewrite working code.
14. Follow security, privacy, authorization, and validation requirements.
15. Never expose or commit secrets or real student data.
16. Test before marking work complete; report verification accurately.
17. Update project status after work.
18. Update docs when architecture, database, or API contracts change.
19. Ask before major architectural changes and explain impact.
20. Resolve or clearly record dependencies; do not skip important requirements.

## Stack restrictions
Frontend: React, Vite, JavaScript/JSX, React Router, TanStack Query, CSS Modules or regular CSS. Backend: Node.js, Express, JavaScript only, ES Modules, REST, JWT, bcrypt, Zod. Database: PostgreSQL and Prisma. Services: Cloudinary, Neon, Render, Vercel, GitHub, GitHub Actions. Never substitute MongoDB/Firebase. Do not begin implementation before scope and documentation approval.

## Mandatory workflow
**READ DOCUMENTATION → INSPECT EXISTING CODE → UNDERSTAND REQUIREMENTS → PLAN IMPLEMENTATION → WRITE CODE → TEST → FIX ERRORS → UPDATE DOCUMENTATION → UPDATE PROJECT STATUS**

The title/scope contradiction must be resolved before product implementation. Proposals are not proof of implementation or stakeholder approval. See [Overview](docs/01-Project-Overview.md), [Requirements](docs/02-Requirements-and-Features.md), and [Roadmap](docs/07-Development-Roadmap.md).
