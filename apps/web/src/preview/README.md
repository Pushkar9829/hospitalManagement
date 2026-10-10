# Preview data

Sample responses for API endpoints that are not built yet, so every screen in the UI/UX design
can be reviewed with realistic content. One file per module: `<module>.preview.js` exporting
`handlers` keyed by `METHOD /path` (relative to /api/v1, `:param` allowed).

- On in `pnpm dev` (set `VITE_PREVIEW_DATA=0` to turn it off); off in tests and production.
- Only paths with a handler are answered here; everything else reaches the real API.
- When a module's real API lands, delete its preview file. Never import from here elsewhere.
- Shapes follow the API conventions: lists are `{ items, total, page, limit }`, money in paise,
  dates as ISO strings.
