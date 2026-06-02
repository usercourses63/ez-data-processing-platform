# 33-03 Summary — Hebrew audit + Help-link + sanity suite

Specs (new):
- `src/Frontend/tests/e2e/phase-33-hebrew-audit.spec.ts`
- `src/Frontend/tests/e2e/phase-33-help-link.spec.ts`

Primary deliverable: `33-VALIDATION-REPORT.md` (aggregated 3-plan report).

## Hebrew audit (`?lng=he`) — 8 routes
- **dir==='rtl' AND lang==='he' on ALL 8 routes** (SC-08 primary contract) — PASS.
- Zero external font requests on all routes (SC-06 sustained) — PASS.
- englishLeaks high-water marks: 7 (invalid-records, admin-settings), 8 (home-root,
  datasources-list, alerts), 9 (datasources-new, ai-assistant), **83 (monitoring)**.
- All exceed the cap of 3 → **soft-assertion fail, dispositioned KNOWN-ACCEPT** (cap NOT
  raised in code, per plan). Breakdown: 7 of every count = the intentional bilingual
  `<noscript>` baseline (tokens `need, enable, JavaScript, this, nbsp, nbsp, JavaScript`).
  Real residual UI-label leaks per route = 0–2 (Schema / financial / Metric / autofill —
  technical/proper terms). monitoring=83 is **live English backend log data** (log levels
  + service messages), not labels.

## Help-link test
- **PASS.** window.open URL = `http://192.168.49.2:30800/docs/user-guide/` → contains `192.168.49.2:30800` (SC-09).
- AppHeader uses `window.open(url, '_blank', 'noopener,noreferrer')`; with `noopener`
  Chromium does not reliably emit a Playwright `popup` event, so the spec asserts the
  `window.open()` argument directly. Confirmed independently via Playwright MCP browser.

## Sanity suite (`npm run test:e2e:sanity`)
- API endpoint mode: **Port-forward** (no NodePort 30080). DATASOURCE_API=5001, METRICS_API=5002, SCHEDULING_API=5004.
- 21 total: **11 passed, 10 failed** (exit 1).
- Failing IDs + disposition (all non-frontend):
  - SANITY-08/09/10 → docs (Docusaurus) portal not deployed on 30800 (+noopener popup) — accept.
  - SANITY-12/21 → invalidrecords chart Service bug (targetPort 5006 ≠ container 5007) — accept (infra).
  - SANITY-02/03/04/05/11 → port-forward saturation under fullyParallel load (endpoints return 200 directly post-run) — accept (harness).
- No Phase 33 frontend regressions.

Screenshots: `src/Frontend/tmp-screenshots/phase-33/he/` (8 PNGs).
Phase deliverable: `33-VALIDATION-REPORT.md`. Overall disposition: **READY-FOR-VERIFY**.
