# Hospital Management System: notes for Claude

A multi-tenant SaaS hospital management system for India. It is a pnpm + Turborepo monorepo in plain JavaScript (ES modules, no TypeScript).

## Map

- `docs/`
  - specification PDF and its source (`docs/spec-src`)
  - UI/UX design boards (`docs/ui-design`)
  - module deep dives (`docs/modules`)
  - the plan, which is the source of truth for phases, structure and the Definition of Done (`docs/implementation/PLAN.md`)
- `apps/api`
  - Express 5 + Mongoose 8 modular monolith.
  - `src/core` is the kernel: tenancy, auth, RBAC, approvals, audit, files, print, events, jobs.
  - `src/modules` holds setup, users, patients and billing.
  - `src/platform` holds SaaS signup, subscriptions, the console API and webhooks.
- `apps/web`
  - React 19 + Tailwind v4 + RTK Query.
  - Screens live in `src/modules/*` and are routed through `src/app/registry.js`.
- `packages/shared`: zod schemas, permissions, money/ID helpers, and the screen and role catalogue generated from the design.
- `packages/ui`: UI kit.
- `packages/i18n`: English and Hindi translations, with one lazily loaded bundle per module.

## Run locally

1. `docker compose -f infra/docker/docker-compose.yml up -d` (MongoDB replica set + Redis)
2. `cp .env.example apps/api/.env`
3. `pnpm install`
4. `pnpm --filter @hms/api seed:dev`
5. `pnpm dev` (API :4000, web :5173), plus the worker: `pnpm --filter @hms/api dev:worker`

Then open http://demo.localhost:5173 as `superadmin` / `Demo@12345`. Every role code (doctor, cashier, …) is also a username.

## Checks (CI runs the same; all must pass before a push)

`pnpm format:check && pnpm lint && pnpm test && pnpm test:int && pnpm build`

The web build enforces a 250 kB gzip initial-JS budget.

## Rules

- Commit only to branch `claude/laughing-babbage-dc0jri`. Don't open PRs unless asked.
- Money is in paise as integers. Dates are IST. Every tenant query goes through the tenant plugin; never bypass it.
- Every route uses `defineRoutes` with permission, audit, schema and summary.
- Risky changes go through approvals (maker-checker). A 202 response means the change is waiting for approval.
- No hex colours in web/ui: use Tailwind tokens. Every screen string has real Hindi.
- Screens whose API is not built yet use dev-only preview data in `apps/web/src/preview/*.preview.js` (see the README there). Production builds never include it.

## Status (keep this section current)

**Done**

- Phase 0 foundation.
- Phase 1 backend: setup, users/roles, patients, billing, the SaaS platform, and the fixes from the leftovers scan. About 96 integration tests.
- Phase 1 admin screens: settings, masters, approvals, audit, users, roles, password flows.

**In progress: build EVERY screen in the UI/UX design with all its tabs.** Follow `docs/implementation/SCREENS_BRIEF.md`.

| Area                          | Boards                                                                                                                            | State                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| OPD and front office          | FrontOffice, Opd, OpdCheckin, OpdTriage, Consult, ClinicDesk, OpdConfig, OpdAnalytics, QueueTV                                    | partly built (`apps/web/src/modules/opd`)                                                    |
| Patients, billing, compliance | Patients, PatientProfile, Billing, BillShift, Subscription, Signup; design check of built screens; Wards and beds / Packages tabs | first version exists, not yet checked against the boards                                     |
| Core admin                    | SetupWizard, Reports, BillConfig, BillCorporate, BillAnalytics, extra Settings/Users/Audit tabs                                   | not started (preview data in `apps/web/src/preview/reports.preview.js`, `coreadmin.seed.js`) |
| Homes and shell               | Dashboard, 25 Home* boards, panel switcher, palette search, approvals bell, F2/F4, States, Hindi menu labels                      | not started (`packages/i18n/src/catalog*.js` exists)                                         |
| Platform console              | Console, ConsoleTenant, served on the `console.` host inside apps/web                                                             | API layer only (`apps/web/src/modules/console`)                                              |
| IPD and nursing               | Admission, Beds, IpdBedRequests, IpdRounds, Nursing, Roster, Discharge, IpdTpa, IpdBill, IpdConfig, IpdAnalytics                  | not started                                                                                  |
| Diagnostics                   | Lab, LabSample, LabQC, LabMicro, LabHisto, LabConfig, LabAnalytics, PhleboPhone, Radiology, Pharmacy, Inventory                   | not started                                                                                  |
| People, support, portal       | Finance, Hr, Payroll, MySpace, Records, Diet, Facility, Quality, Crm, Portal, PortalBooking, PortalStay, PortalPay                | not started                                                                                  |

`apps/web/src/modules/dx-kit` is a shared screen kit (UrlTabs, RecordsTable, FormDialog, KpiRow, …); reuse it.

**After the screens**

- Backend APIs that the screens assume. Each preview file documents the contract.
- Test the new masters: wards, beds, packages, payers, doctors. The test is in `apps/api/test/int/setup.int.test.js` and has not been run yet.
- The remaining leftovers in `docs/implementation/PLAN.md` §14: Terraform and staging, Sentry/OpenTelemetry, migrations, DPDP items, a real SMS provider.
