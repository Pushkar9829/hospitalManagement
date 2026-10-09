# Hospital Management System

Multi-tenant SaaS hospital management system for India.

- **Stack:** React + Tailwind (web), Node.js + Express + MongoDB (API), all JavaScript.
- **Hosting:** AWS: S3 + CloudFront for the web app, ECS Fargate for the API.

| Where             | What                                                                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `docs/`           | Phase 1 specification (PDF), module deep dives, UI/UX design, implementation plan                                                   |
| `apps/api`        | REST API, Socket.IO and the background worker ([README](apps/api/README.md))                                                        |
| `apps/web`        | Hospital staff web app (React, Tailwind)                                                                                            |
| `packages/shared` | Zod schemas, permissions, module codes, money and Indian ID helpers, and the screen and role catalogue generated from the UI design |
| `packages/ui`     | Tailwind design tokens and the component library                                                                                    |
| `packages/i18n`   | English and Hindi translations                                                                                                      |
| `infra/docker`    | Local MongoDB (replica set), Redis and Mailpit                                                                                      |

## Getting started

```bash
corepack enable && pnpm install
docker compose -f infra/docker/docker-compose.yml up -d    # MongoDB rs0, Redis, Mailpit
cp .env.example apps/api/.env
pnpm --filter @hms/api seed:dev                            # demo hospital + one user per role
pnpm dev                                                   # API :4000, web :5173
```

Open http://demo.localhost:5173 and sign in as `superadmin` (or `doctor`, `nurse`, `cashier` …) with the password the seed prints.

## Checks (CI runs the same)

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:int && pnpm build
pnpm catalog   # regenerate screens and role panels from docs/ui-design (CI fails if out of date)
```

Build progress follows `docs/implementation/PLAN.md`. Phase 0 (foundation) is in place; each module is merged only when it meets the plan's production-ready checklist.
