# Brief for every screen agent

The goal is to build every screen in the UI/UX design as real React code, with all of its tabs, tables, forms, side panels, dialogs and states, so the whole product can be clicked through. Several agents work in parallel in the same working tree, each on its own set of boards.

## Repo and stack
- Branch: claude/laughing-babbage-dc0jri.
- Stack: plain JavaScript ES modules, React 19, Tailwind v4 (tokens only, no hex colours, lint enforces this), Radix, TanStack Table, RTK Query, react-router 7, i18next en + hi, Vite 7.
- Do NOT commit or push. Do NOT `pnpm add` anything.
- Do not edit apps/api or packages/shared; the parent session owns them.

## Read before you start
- docs/ui-design/screens.md: inventory, the API per screen, build rules 1–13, the components table.
- docs/ui-design/panels.md: role menus.
- docs/ui-design/README.md.
- Your boards in docs/ui-design/boards/*.dc.html. Each board is HTML with a `<script>` holding its data:
  - `tabDefs()` lists the tabs and, per tab, the panel title, actions (`acts`), table columns (`head`), sample rows, KPIs, form fields and notes.
  - The main tab is drawn in the HTML markup.
  - Build EVERY tab and every action on the board.
- The module deep dives for flows and rules, where they exist: docs/modules/{OPD,IPD,BILLING,LAB}.md.
- Existing code to copy the conventions from:
  - apps/web/src/app/{registry.js,router.jsx,screens.js,baseApi.js,previewData.js}
  - apps/web/src/components/*, apps/web/src/lib/* (useCan, useUrlState, money, dates, forms, useStrings)
  - apps/web/src/modules/{setup,users,approvals,audit,patients,billing}
  - packages/ui (DataTable, Sheet, DiffTable, StateViews, PageHeader, StatusBadge, Tabs …)
  - packages/i18n (makeBundle pattern: billing.js / billing.en.js / billing.hi.js and the package.json exports)

## Data: real API first, preview data otherwise
- Where the API exists (check apps/api/src/**/*.routes.js), use it.
- Where it does not exist yet, which is the case for all OPD, IPD, lab, radiology, pharmacy, inventory, HR, payroll, finance, MRD, diet, facility, quality, CRM, portal, reports, dashboards and home pages:
  - Write RTK Query endpoints against the planned contract from screens.md (paths under /api/v1, lists as `{ items, total, page, limit }`, money in paise, ISO dates).
  - Add preview handlers in `apps/web/src/preview/<module>.preview.js` exporting `handlers` keyed `'METHOD /path'`. See apps/web/src/preview/index.js and README.md.
  - Preview data must be realistic Indian hospital data, consistent across screens (same patients, UHIDs, doctors, wards). Writes should return sensible results so flows can be clicked through (an in-memory array is fine).
  - Put `<PreviewBanner module="…" />` (apps/web/src/components/PreviewBanner.jsx) at the top of pages that use preview data.
- Never put sample data directly in components; it only lives in preview files.

## Wiring (shared files: keep edits minimal, re-read right before editing, small Edit replacements only)
- apps/web/src/app/registry.js:
  - Add your lazy page imports and `PAGES` entries (screen key → component).
  - Screen keys are the catalogue keys in packages/shared/src/catalog/screens.js (read only) plus apps/web/src/app/screens.js.
  - If a screen you need is missing from the catalogue, say so in your report and route it from a parent page with tabs or a sub-route instead.
- apps/web/src/app/baseApi.js: add the tag types you need to `tagTypes`.
- packages/i18n:
  - One bundle per module: `<module>.js`, `<module>.en.js`, `<module>.hi.js`, plus an export line in package.json.
  - Load it in your pages with useStrings.
  - Real Hindi, same keys as English. Run `pnpm --filter @hms/i18n test`; extend the parity test if bundles are listed there.
- Your code lives in apps/web/src/modules/<module>/ (api.js, pages/, components/, tests).
- Shared UI that is really reusable (Stepper, Timeline, Kanban, BedTile, SlotGrid, StatTile, Combobox, DatePicker …) goes into packages/ui only if it doesn't exist yet. Check first. Another agent may be adding it at the same moment, so prefer a module-local component unless it's clearly generic.

## Quality bar
- Every tab, action, column, filter and KPI from the board.
- Loading, empty, error and permission-denied states.
- Tabs, filters and selected rows in the URL (useUrlState).
- Money via the money helpers (₹1,23,456.00); dates as "09 Oct 2026", times in 24-hour format, IST; IDs in the mono font.
- Forms: React Hook Form + zod, validated on blur and on submit; errors under the fields.
- Status chips: colour + text.
- Keyboard reachable, labels on every input, visible focus.
- Layout works at 768 px.
- Patient-context screens show PatientBanner.
- 202 approval flows use PendingApprovalNotice.
- Pages are lazy route chunks. The initial JS budget is 250 kB gzip (about 232 kB is used now), so nothing heavy goes into the initial bundle.
- Tests:
  - Testing Library tests per page: renders the tabs, a main action, an empty state.
  - Use the existing test helpers (apps/web/src/test/renderApp.jsx, fixtures.js).
  - Preview data is OFF in tests, so mock the API the same way the existing tests do.

## Gates before you report (all must pass)
- `pnpm --filter @hms/web test`, `pnpm --filter @hms/ui test`, `pnpm --filter @hms/i18n test`
- `npx eslint apps/web packages/ui packages/i18n`
- `npx prettier --check apps/web packages/ui packages/i18n` (`--write` twice if needed)
- `pnpm --filter @hms/web build` (budget check included)

Other agents' unfinished files may break a gate. If so, re-run in a minute. If a failure is clearly someone else's, note it and move on; don't edit their files.

## Screenshots
- Run the web app: `cd apps/web && HMS_API_URL=http://localhost:4100 npx vite --port <your port>`. Use a port from your brief so agents don't collide.
- The API runs on :4100 (another agent started it). If it isn't up, start your own on another port:
  - (apps/api) `NODE_ENV=development MONGO_URI="mongodb://127.0.0.1:27017/hms_dev?replicaSet=rs0" REDIS_URL=redis://127.0.0.1:6379 PORT=<port> node src/server.js`
  - Point HMS_API_URL at it.
- Sign in at http://demo.localhost:<port> as `superadmin` / `Demo@12345`, or as a role user (username = role code, e.g. doctor, nurse, cashier, lab, pharmacy, hr). 2FA is off.
- Use Playwright (Chromium is preinstalled; see apps/web/e2e/smoke.mjs for how it launches).
- Save screenshots of every tab to `.screens/<module>/` (git-ignored).
- Look at them yourself against the boards and fix the differences.
- Never use broad `pkill -f` patterns; kill only your own PIDs.

## Final report (concise)
- Boards → pages built, with every tab.
- Per-board check (OK / gap and why).
- Files touched outside your module.
- Test and gate results.
- Catalogue gaps.
- API contracts you assumed, which the backend must implement later: path, method, request and response shape.
