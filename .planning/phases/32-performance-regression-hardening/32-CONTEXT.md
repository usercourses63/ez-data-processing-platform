# Phase 32: Clean Install & End-to-End Acceptance Test - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy v0.5.0 from the offline deployment package onto a completely clean cluster simulating a new OCP environment, then run Playwright-automated end-to-end acceptance tests covering: NAS provisioning (frontend only), datasource CRUD (frontend only), full pipeline cycle, and no-output pipeline edge case.

**Note:** Phase name in ROADMAP.md ("performance-regression-hardening") is a legacy label from pre-planning. The actual scope is a clean install acceptance test. Planner should update ROADMAP.md phase description to reflect this.

</domain>

<decisions>
## Implementation Decisions

### Cluster Cleanup
- **D-01:** Full namespace wipe before deploy: delete namespace + all Released/Retained PVs (cluster-scoped — survive namespace deletion)
- **D-02:** Unmount and delete ALL PVs before wipe — do not leave any stale bindings that block new PVC creation
- **D-03:** Simulate a clean OCP environment — no shortcuts, no reuse of existing cluster state

### Deploy Method
- **D-04:** Use `install.ps1` from the deployment package (`dist/deployment-v0.5.0-{timestamp}/`)
- **D-05:** Do NOT use `scripts/clean-deploy.sh` — the install.ps1 is the production install path being validated
- **D-06:** Run `install.ps1 --local` (single replicas, reduced resources for Minikube dev environment)
- **D-07:** Images must be loaded into minikube from the deployment package (`images/` directory) before running install.ps1

### DemoDataGenerator
- **D-08:** Run with: `--use-simulator --create-servers --direct-connection --simulator-url http://{simulator-ip}:{port}`
- **D-09:** Include NAS device creation (records in DB) but WITHOUT `--provision-nas` flag — NAS devices appear in frontend unprovision state
- **D-10:** Do NOT pass `--provision-nas` — NAS provisioning is validated from frontend only

### NAS Provisioning
- **D-11:** Provision all NAS devices exclusively from frontend: Admin → NAS Devices → Provision button
- **D-12:** No API calls for NAS provisioning — if API is needed as fallback, that is a bug to fix, not a shortcut to take
- **D-13:** Verify each NAS device reaches "Provisioned" state in UI after clicking provision

### Datasource CRUD
- **D-14:** All datasource operations from frontend only (no API): create, edit, delete
- **D-15:** "Create from file" — upload a sample CSV/JSON file and verify schema auto-generation in UI
- **D-16:** "Clone" — clone a datasource from both list page actions and details page header
- **D-17:** No API shortcuts for verification — check results in the UI, not via API calls

### Pipeline Tests
- **D-18:** Full pipeline test: create a valid datasource with output destination → trigger processing → verify records appear in output
- **D-19:** No-output pipeline test: create a datasource WITHOUT any output destination configured → trigger processing → verify job completes with no error (not a failure, no error log)
- **D-20:** Test method: Playwright automated E2E tests AND/OR Claude-in-Chrome extension (see Test Tooling below)

### Documentation Test
- **D-25:** Test the Help button in the frontend: clicking Help must redirect to Docusaurus user guide, NOT a static HTML page
- **D-26:** Docusaurus must serve v0.5.0 user guide content — verify the page title/heading shows v0.5.0
- **D-27:** Port auto-detection must work without manual config: `getDocsBaseUrl()` in `src/Frontend/src/utils/docs-url.ts` computes `http://{hostname}:30800` on dev/private-IP — test must confirm the correct URL is used (NodePort 30800, Docusaurus service)
- **D-28:** Success criteria: Help click → browser lands on `http://{minikubeIP}:30800/docs/user-guide/` → page renders Docusaurus v0.5.0 user guide (not blank, not 404, not old static content)

### Test Tooling
- **D-29:** Use Claude-in-Chrome extension (`mcp__claude-in-chrome__*`) for browser automation — it is pre-connected, no connection verification needed
- **D-30:** Chrome extension can replace OR supplement Playwright spec files at planner's discretion — both are valid for this phase
- **D-31:** Do NOT add a "verify Chrome extension is working" step — assume it works, just use it directly
- **D-32:** Chrome extension is preferred for interactive tests that are hard to automate in headless Playwright (e.g., docs redirect, NAS provisioning UI flow)

### Test Patterns (carry forward from Phase 30-31)
- **D-21:** Use `extractId()` / `extractData()` helpers for API response handling
- **D-22:** `antTabClick()` helper for RTL Ant Design tab navigation
- **D-23:** API context for cleanup: `?deletedBy=SanityTest` on DELETE calls
- **D-24:** PascalCase for API request payloads

</decisions>

<specifics>
## Specific Ideas

- "Use the generated offline package" — validates the production install path (install.ps1), not the dev scripts
- "Totally clean to simulate a new OCP environment" — no leftover state from previous cluster session
- "Remember to unmount and delete PVs" — PVs are cluster-scoped, survive namespace deletion; explicit PV cleanup required
- "NAS provision from frontend only, no API" — tests real user flow, not API shortcut
- "Datasource CRUD including create from file, clone — all from frontend, no API"
- "Full cycle": create datasource → set schema → set output → execute pipeline → verify records processed
- "Pipeline without any output runs OK without errors" — no-output is a valid configuration, not an error state
- "Documentation navigation should succeed" — Help button must open Docusaurus v0.5.0 user guide, not a static page
- "Test the correct port is used without any manual configuration" — `getDocsBaseUrl()` auto-detects NodePort 30800 on private IPs
- "Use Chrome extension — it is connected and working, do not rely on any other connection test"

</specifics>

<canonical_refs>
## Canonical References

### Deployment Package
- `dist/deployment-v0.5.0-20260327-000831/install.ps1` — Install script being tested
- `dist/deployment-v0.5.0-20260327-000831/DEPLOYMENT-GUIDE.md` — Deployment guide with install steps
- `dist/deployment-v0.5.0-20260327-000831/values-local.yaml` — Values for local Minikube install

### Cluster Cleanup Reference
- `scripts/clean-deploy.sh` — Reference for PV cleanup logic (lines handling `kubectl get pv` + delete Released PVs) — DO NOT RUN THIS, use install.ps1 instead; read only for PV cleanup approach

### Existing Test Patterns
- `src/Frontend/tests/e2e/sanity.spec.ts` — Canonical patterns: extractId, extractData, antTabClick, antSelect, apiContext
- `src/Frontend/playwright.config.ts` — Multi-project config, baseURL, timeouts
- `src/Frontend/tests/e2e/clone-datasource.spec.ts` — Clone test patterns (Phase 31)
- `src/Frontend/tests/e2e/import-from-file.spec.ts` — Import-from-file test patterns (Phase 31)

### Documentation URL Logic
- `src/Frontend/src/utils/docs-url.ts` — `getDocsBaseUrl()`: auto-detects dev vs prod, returns `http://{hostname}:30800` on private IPs
- `src/Frontend/src/pages/help/HelpPage.tsx` — Redirects to `{docsBaseUrl}/docs/user-guide/` on mount
- `src/Frontend/src/components/layout/AppHeader.tsx` — Help button using `openDocsInNewTab`
- `k8s/deployments/docs-deployment.yaml` — Docusaurus deployment, NodePort 30800

### DemoDataGenerator
- `tools/DemoDataGenerator/` — Source code for data generator
- `CLAUDE.md` §DemoDataGenerator — Correct command flags and simulator options

### Infrastructure
- `CLAUDE.md` §Port Forwarding — Port map after install (frontend 7000, API 5001, etc.)
- `k8s/services/all-services.yaml` — Service port definitions
- `helm/ez-platform/values.yaml` — Image tags and service configuration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `antTabClick`, `antSelect`, `extractId`, `extractData` helpers in `sanity.spec.ts` — copy into new test file (do not import)
- Playwright multi-project config with `sanity` and `chromium` projects
- `apiContext` fixture for backend API calls within Playwright tests
- Claude-in-Chrome MCP tools: `mcp__claude-in-chrome__navigate`, `mcp__claude-in-chrome__find`, `mcp__claude-in-chrome__javascript_tool`, `mcp__claude-in-chrome__get_page_text`, `mcp__claude-in-chrome__tabs_create_mcp` — for browser-driven interactive tests

### Established Patterns
- API-first verification for pipeline results (check DB via API, not UI pagination)
- Cleanup via `DELETE /api/v1/datasource/{id}?deletedBy=SanityTest`
- RTL viewport `1440x900` for Hebrew UI tests
- `DATASOURCE_API = 'http://127.0.0.1:5001'` and `FRONTEND_URL = 'http://127.0.0.1:7000'` (or NodePort equivalents after fresh install)

### Integration Points
- NAS provisioning: `POST /api/v1/nasdevices/{id}/provision` (NOT to be called in tests — frontend only)
- Pipeline trigger: DataSource scheduling or manual trigger endpoint
- Pipeline status: monitoring page or `GET /api/v1/jobs` to verify completion

</code_context>

<deferred>
## Deferred Ideas

- k6 performance tests (smoke/load extension) — original Phase 32 scope, deferred to Phase 33 or standalone
- Regression suite / CI gate ordering — deferred
- i18n deep testing (pluralization, date formatting) — deferred
- install.ps1 fixes (Helm post-install hook timeout workaround) — may surface during this phase; fix inline if minor

</deferred>

---

*Phase: 32-performance-regression-hardening (scope: clean install + E2E acceptance test)*
*Context gathered: 2026-03-27*
