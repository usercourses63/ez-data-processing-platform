# Phase 33: Frontend i18n + Foundation Deploy & Cluster Validation — Context

**Gathered:** 2026-05-25
**Status:** Ready for planning
**Source:** Direct user request — deploy and validate i18n/foundation work committed in 4 atomic commits.

<domain>
## Phase Boundary

Build the frontend Docker image with the four-commit i18n + foundation work, load into minikube, Helm-upgrade the EZ platform with the new `services.frontend.config.docsUrl` value, then validate the deployed frontend against the running cluster in both English and Hebrew modes via Playwright (Edge channel).

**In scope:**
- Building `src/Frontend/Dockerfile` with the new entrypoint + bundled fontsource assets
- Loading the image into the local minikube cluster
- Running `helm upgrade` on `release-package/helm/ez-platform` with `--set services.frontend.config.docsUrl=<url>`
- Waiting for the frontend pod rollout
- Restarting port-forwards (CLAUDE.md note: `scripts/start-port-forwards.ps1`)
- Validating deployed (not dev-server) state — including `/config.js` injection, zero external font fetches, English-mode UI cleanness, Hebrew-mode regression check, Help/docs link navigation
- Running the existing sanity test suite against the deployed cluster

**Out of scope:**
- file-simulator-suite deployment (handled in a parallel Claude Code session per user's split-work pattern)
- Backend microservice rebuilds (only the frontend is being shipped this phase)
- CSS logical-properties refactor (separate tech-debt item, not committed yet)
- New feature work — this is a deploy + validation phase only

</domain>

<decisions>
## Implementation Decisions

### Source commits being shipped
- `f139193` build(frontend): add @fontsource/rubik for self-hosted fonts
- `3d8fa19` feat(helm): runtime config injection for configurable docs URL
- `28586da` fix(frontend): English-mode rendering — fonts, RTL/LTR, language detection
- `2164d9d` feat(i18n): complete English locale parity (+720 keys), refactor 280+ hardcoded literals

### Deployment shape
- Single frontend service deploy via Helm (no other services rebuilt this phase)
- Minikube as the target cluster (CLAUDE.md primary dev environment)
- `--set services.frontend.config.docsUrl=...` provided at install/upgrade time — operator chooses the URL
- The existing 9 backend microservices remain at their current image tags (their bytecode is unaffected by this work)

### Validation shape
- Playwright via Edge channel (`channel: 'msedge'`) — confirmed working in prior session, no chromium download needed
- Multi-route audit: 8 routes (datasources-list, datasources-new, invalid-records, alerts, dashboard, ai-assistant, admin-settings, monitoring)
- Audit script seeds `?lng=en` AND `?lng=he` for both-language regression
- Expected leak baseline: 2 intentional hits per page (NOSCRIPT bilingual message + "עב" Hebrew-toggle label) — anything above 2 is a regression
- Visual screenshots captured per route for both languages

### Cluster prep
- Minikube is already running (started earlier in session). If stopped between sessions, run `minikube start`.
- Port-forwards via `scripts/start-port-forwards.ps1` per CLAUDE.md
- DemoDataGenerator already seeded data in prior phases; re-run only if cluster was wiped

### Coordination
- A parallel Claude Code session is handling the file-simulator-suite (per user, cloned to `C:\Users\Brian\Desktop\ez-simulator`). The frontend deploy in this phase is independent — both can run on the same minikube without conflict.

### Claude's Discretion
- Exact docsUrl value to test with (suggest `http://$(minikube ip):30800` for the existing K8s NodePort)
- Whether to capture before/after screenshots in a `tmp-screenshots/phase-33/` directory
- Whether to write a small validation Node script or extend the existing `tmp-hebrew-audit-multi.mjs` pattern
- Helm release name (default: `ez` or whatever the existing release is named — `helm list -n ez-platform` to confirm)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source code touched by the commits
- `src/Frontend/Dockerfile` — uses `/docker-entrypoint.sh` as CMD
- `src/Frontend/docker-entrypoint.sh` — writes `window.EZ_CONFIG` from `$EZ_DOCS_URL`
- `src/Frontend/public/config.js` — dev-mode stub `window.EZ_CONFIG = {}`
- `src/Frontend/src/utils/docs-url.ts` — 3-tier resolution
- `src/Frontend/src/i18n/index.ts` — `fallbackLng: 'en'`, `lng` removed, querystring detection
- `src/Frontend/src/i18n/locales/en.json` + `he.json` — 1184 keys each, perfect parity

### Helm chart changes
- `release-package/helm/ez-platform/values.yaml` — added `services.frontend.config.docsUrl: ""`
- `release-package/helm/ez-platform/templates/deployments/frontend-deployment.yaml` — exposes `EZ_DOCS_URL` env var

### Project standards
- `CLAUDE.md` — port-forward script path (`scripts/start-port-forwards.ps1`), minikube as primary dev cluster, npm dep workaround (`--legacy-peer-deps` for React 19 vs `@testing-library/react@14` peer conflict — already installed)
- `src/Frontend/playwright.config.ts` — Playwright baseURL is `http://localhost:7000` (the port-forward target, not dev-server's 3002)

### Verification artifacts from prior session
- `tmp-screenshots/multi-route-audit.json` — last dev-server audit baseline (2 hits per route)
- `tmp-screenshots/01-english-full.png` — DataSources page reference screenshot

</canonical_refs>

<specifics>
## Specific Ideas

### Build commands
```powershell
cd src/Frontend
npm run build
docker build -t frontend:v0.5.x .
minikube image load frontend:v0.5.x
```

### Helm upgrade with docsUrl
```powershell
helm upgrade ez ./release-package/helm/ez-platform `
  --set services.frontend.image.tag=v0.5.x `
  --set services.frontend.image.pullPolicy=IfNotPresent `
  --set services.frontend.config.docsUrl=http://$(minikube ip):30800
kubectl rollout status deployment/frontend -n ez-platform
```

### Verification one-liners
```powershell
# Zero external font requests
curl -s http://localhost:7000/ | Select-String -Pattern "googleapis|gstatic"

# Helm value reached the container
curl -s http://localhost:7000/config.js
# Expected: window.EZ_CONFIG = { docsUrl: "http://192.168.X.X:30800" };

# Sanity tests
cd src/Frontend && npm run test:e2e:sanity
```

### Audit script reuse
Extend or rerun the `tmp-hebrew-audit-multi.mjs` pattern (lives in `src/Frontend/`), changing `URL` from `http://127.0.0.1:3002/` to `http://localhost:7000/`. Run twice: once with `localStorage.i18nextLng = 'en'` seed, once with `'he'` seed. Compare leak counts.

</specifics>

<deferred>
## Deferred Ideas

- **CSS logical-properties refactor** — replace physical `margin-left/right`, `padding-left/right`, `left:`, `right:`, `text-align: right/left` with logical equivalents (`margin-inline-start/end`, `inset-inline-start/end`, `text-align: start/end`) across `App.css`, page-level CSS. Large separate scope, not blocking, recommended as future tech-debt.
- **Icon mirroring audit** — directional icons (chevrons, breadcrumb separators, navigation arrows) should mirror via `[dir='rtl'] .icon-directional { transform: scaleX(-1) }`. Audit + apply class to relevant icons.
- **`dir="ltr"` on LTR-natural inputs** — email, tel, URL, password inputs inherit page direction; in Hebrew mode they render readable English text right-to-left. Add `dir="ltr"` to those inputs across the codebase.
- **CI key-parity lint** — `scripts/check-i18n-parity.mjs` + npm `lint:i18n` script that fails if en.json and he.json key sets diverge. Prevents the 561-key gap from recurring.
- **CronHelperDialog.tsx i18n** — file has parallel `name`/`nameHebrew` columns but `description` is Hebrew-only across ~30 cron patterns. Not audited in this phase.
- **Backend Hebrew error messages** — toast errors like `'שגיאה בעדכון סטטוס'` originate from `.NET` backend responses. These bypass frontend i18n entirely. Separate backend-side fix needed.
- **ai-assistant/ being a mockup** — the entire AIAssistant.tsx page is hardcoded demo content. Now t()-driven, but the underlying feature isn't a real product yet. Future phase: replace mock with real backend.

</deferred>

---

*Phase: 33-frontend-i18n-foundation-deploy-cluster-validation*
*Context gathered: 2026-05-25 via direct user request after 4-commit i18n/foundation push*
