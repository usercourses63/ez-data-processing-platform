# Phase 33: Frontend i18n + Foundation Deploy & Cluster Validation — Research

**Researched:** 2026-05-25
**Domain:** Helm-deploy of a single React/nginx image to minikube + Playwright validation against the deployed cluster (Windows + PowerShell)
**Confidence:** HIGH (commits already on `origin/main`, all referenced files exist, cluster state probed live)

## Summary

The four source commits (`f139193`, `3d8fa19`, `28586da`, `2164d9d`) are present in `HEAD` of `main` and add a complete runtime-config injection path: `index.html` already loads `/config.js` first, `docker-entrypoint.sh` already writes that file from `$EZ_DOCS_URL`, the Helm `frontend-deployment.yaml` already sets `EZ_DOCS_URL` from `services.frontend.config.docsUrl`, and `src/utils/docs-url.ts` already reads `window.EZ_CONFIG.docsUrl` first. **No code changes are needed** — Phase 33 is pure build + deploy + validate.

Two corrections to CONTEXT.md's narrative were found during environment probe:
1. **The `ez-platform` namespace does not exist on minikube right now** (`kubectl get ns ez-platform` → NotFound, `helm list -n ez-platform` → empty). Phase 33 is a `helm install`, not a `helm upgrade`. The roadmap's docsUrl-validates-via-`upgrade` wording is aspirational.
2. **The existing Playwright sanity project uses `channel: 'chrome'`, not `'msedge'`** (`playwright.config.ts:144`). CONTEXT.md's Edge claim reflects a prior ad-hoc session, not the configured project. Recommend reusing `chrome` for consistency with the sanity suite.

**Primary recommendation:** Run all commands from `src/Frontend/` and the repo root in PowerShell. Build with `npm run build` (Vite — already configured), `docker build`, `minikube image load`, `helm install ez ./release-package/helm/ez-platform --set services.frontend.config.docsUrl=http://192.168.49.2:30800 --set services.frontend.image.tag=v0.5.x --set services.frontend.image.pullPolicy=Never -n ez-platform --create-namespace`. Validate `/config.js` over HTTP first (cheapest assertion), then run Playwright audits with `BASE_URL=http://localhost:7000` (after port-forwards) using the existing `sanity` and a new ad-hoc multi-route audit script.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Source commits being shipped:**
- `f139193` build(frontend): add @fontsource/rubik for self-hosted fonts
- `3d8fa19` feat(helm): runtime config injection for configurable docs URL
- `28586da` fix(frontend): English-mode rendering — fonts, RTL/LTR, language detection
- `2164d9d` feat(i18n): complete English locale parity (+720 keys), refactor 280+ hardcoded literals

**Deployment shape:**
- Single frontend service deploy via Helm (no other services rebuilt this phase).
- Minikube as the target cluster.
- `--set services.frontend.config.docsUrl=...` provided at install/upgrade time.
- Existing 9 backend microservices remain at their current image tags.

**Validation shape:**
- Playwright via Edge channel (CONTEXT.md statement — but see note above; existing sanity project uses Chrome).
- Multi-route audit: 8 routes (datasources-list, datasources-new, invalid-records, alerts, dashboard, ai-assistant, admin-settings, monitoring).
- Audit covers both `?lng=en` and `?lng=he`.
- Expected leak baseline: **2 intentional hits per page** (`<noscript>` bilingual + `עב` toggle label).
- Visual screenshots captured per route for both languages.

### Claude's Discretion

- Exact `docsUrl` value to test with — recommend `http://192.168.49.2:30800` (the live `minikube ip` output).
- Whether to write screenshots to `tmp-screenshots/phase-33/`.
- Whether to write a small validation Node script or extend `tmp-hebrew-audit-multi.mjs`. **Note:** `tmp-hebrew-audit-multi.mjs` does NOT exist in the repo (it was an ad-hoc script from the prior session). A new audit script under `src/Frontend/tmp-phase-33-audit.mjs` is the recommended path; pattern is captured in `test-comprehensive.mjs` which still exists.
- Helm release name — `helm list -n ez-platform` returned empty, so the install command must supply the name (`ez` is the sensible default per CONTEXT.md).

### Deferred Ideas (OUT OF SCOPE)

- CSS logical-properties refactor
- Icon mirroring audit
- `dir="ltr"` on LTR-natural inputs
- CI key-parity lint (`scripts/check-i18n-parity.mjs`)
- `CronHelperDialog.tsx` i18n
- Backend Hebrew error messages
- `ai-assistant/` page being a mockup

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Build static React bundle (`npm run build`) | Developer workstation | — | Pre-image-build; Vite + tsc produce `build/` consumed by `Dockerfile` |
| Image build with bundled fontsource WOFF2 | Docker (minikube docker-env) | — | `Dockerfile` copies `build/` into nginx image; `@fontsource/rubik` is hashed into `build/assets/*.woff2` at build time |
| Image distribution to cluster | minikube containerd | — | `minikube image load <tag>` puts the tag into minikube's own image store; node-local cache |
| Runtime config injection (`$EZ_DOCS_URL` → `/config.js`) | Container entrypoint | nginx | `docker-entrypoint.sh` writes `/usr/share/nginx/html/config.js` and `exec nginx -g 'daemon off;'`; nginx serves it as a static asset |
| Helm value plumbing | Helm template (cluster install-time) | Deployment env var | `values.yaml services.frontend.config.docsUrl` → `frontend-deployment.yaml EZ_DOCS_URL` env → entrypoint reads, writes file |
| Browser-side docsUrl resolution | React/Browser | — | `src/utils/docs-url.ts` reads `window.EZ_CONFIG.docsUrl` first, falls back to `{hostname}:30800` heuristic, then `/docs` |
| Language detection | Browser (i18next) | — | `?lng=` querystring wins, then `localStorage`, then navigator, then `<html lang>` |
| External access to frontend | `kubectl port-forward` (PowerShell job) | NodePort | `scripts/start-port-forwards.ps1` forwards `svc/frontend:8080 → localhost:7000` |
| Multi-route audit + Hebrew-leak detection | Playwright (host) | — | Runs outside cluster via baseURL = http://localhost:7000; uses chromium with `channel: 'chrome'` |
| Sanity gate | `npm run test:e2e:sanity` (Playwright sanity project) | — | Hits NodePort (default `172.30.22.206:30080` — must override `BASE_URL` for this phase) |

## Standard Stack

### Core

| Tool | Version (verified live) | Purpose | Why Standard |
|------|------------------------|---------|--------------|
| Helm | v3.16.2 [VERIFIED: `helm version`] | Cluster install/upgrade | Already used by the project; `release-package/helm/ez-platform/` is the deploy contract |
| minikube | v1.36.0 [VERIFIED: `minikube version`] | Local cluster | CLAUDE.md primary dev cluster; `minikube image load` is the supported image-injection path |
| kubectl | v1.33.1 [VERIFIED: `kubectl version --client`] | Pod / rollout / port-forward | Standard K8s CLI |
| Node.js | v24.16.0 [VERIFIED: `node --version`] | Vite build host + Playwright runtime | Already used; matches `package.json` engines target |
| Playwright | 1.49 [CITED: `package.json` devDeps] | E2E + audit | Already pinned; `test:e2e:sanity` project exists |
| `@fontsource/rubik` | ^5.2.8 [CITED: `package.json`] | Self-hosted Hebrew/Latin font | Replaces Google Fonts CDN dependency |

### Supporting

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Docker CLI (in `minikube docker-env`) | Build image directly into minikube's image store, skipping `image load` | If `npm run build && docker build && minikube image load` is too slow, switch to `Invoke-Expression (minikube -p minikube docker-env --shell powershell)`, then build — image is immediately available to the cluster |
| PowerShell (`pwsh`) | Host shell on Windows | All commands; use `$(minikube ip)` works under PowerShell as a sub-expression |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `minikube image load frontend:v0.5.x` | `eval $(minikube docker-env)` then `docker build` | `docker-env` is faster (no save/load round-trip) but is a per-shell env mutation; on PowerShell use `Invoke-Expression (& minikube -p minikube docker-env --shell powershell)`. The `image load` path is more cache-friendly across reboots. |
| `docker save | minikube ssh docker load` | — | Strictly worse than `minikube image load` (which does this internally with the right driver) |
| `helm upgrade --install` | Plain `helm install` | `upgrade --install` is the idempotent form — recommended because the chart may already be installed in some sessions even though it isn't right now |
| New `tmp-phase-33-audit.mjs` | Extending `test-comprehensive.mjs` | The latter is import-from-file specific; cleaner to write a fresh script with the Hebrew-leak logic |

## Package Legitimacy Audit

Phase 33 installs **no new npm packages** — `@fontsource/rubik` is already in `package.json` (committed in `f139193`) and was vetted prior. No `npm install` of new dependencies is on the critical path for this phase. Slopcheck audit therefore N/A; existing `node_modules` and `package-lock.json` are the source of truth.

If `npm ci` is run as part of a clean build, it pulls only locked, already-published packages — no new attack surface introduced by this phase.

## Architecture Patterns

### System Architecture Diagram

```
[Developer Workstation - PowerShell]
        │
        │ 1. npm run build  (Vite → src/Frontend/build/)
        │ 2. docker build -t frontend:v0.5.x  (bakes build/ + entrypoint into nginx:alpine)
        │ 3. minikube image load frontend:v0.5.x
        ▼
[minikube image store (containerd)]
        │
        │ 4. helm install ez ./release-package/helm/ez-platform \
        │      --set services.frontend.image.tag=v0.5.x \
        │      --set services.frontend.image.pullPolicy=Never \  ← critical: avoids registry pull
        │      --set services.frontend.config.docsUrl=http://192.168.49.2:30800
        ▼
[K8s Deployment "frontend" in ez-platform namespace]
        │ env: EZ_DOCS_URL=http://192.168.49.2:30800
        │
        │ 5. Pod starts → CMD ["/docker-entrypoint.sh"]
        │      └─ writes /usr/share/nginx/html/config.js
        │      └─ exec nginx -g 'daemon off;'
        ▼
[Service "frontend" (LoadBalancer, port 80 → containerPort 8080)]
        │
        │ 6. kubectl port-forward svc/frontend 7000:8080  (via start-port-forwards.ps1)
        ▼
[localhost:7000 on the workstation]
        │
        │ 7a. curl /config.js   ← assert: contains the Helm-supplied URL
        │ 7b. curl /            ← assert: no googleapis|gstatic references
        │ 7c. Playwright: 8 routes × {?lng=en, ?lng=he} × {screenshot, leak-count, console errors}
        │ 7d. Playwright: Help button (header) + Footer Documentation link → docsUrl popup
        │ 7e. npm run test:e2e:sanity (with BASE_URL=http://localhost:7000)
        ▼
[Pass/Fail report in tmp-screenshots/phase-33/ + console]
```

### Recommended Plan Layout

```
src/Frontend/
├── tmp-phase-33-audit.mjs    # NEW — multi-route Hebrew-leak + console + screenshot script
└── tmp-screenshots/phase-33/  # NEW — output directory
    ├── en/
    │   ├── 01-datasources.png
    │   ├── ...8 routes
    │   └── leak-report.json
    └── he/
        └── (same structure)
```

### Pattern 1: Helm-injected runtime config (validate end-to-end)

**What:** The Helm value reaches the browser through 5 hops: chart values → Deployment env → container env → entrypoint shell var → file write → nginx-served asset → browser-loaded global.

**Pitfall:** A break at any hop is silent. Verify with two independent assertions:

```powershell
# HTTP-level: curl the deployed config.js
curl -s http://localhost:7000/config.js
# Expected literal: window.EZ_CONFIG = { docsUrl: "http://192.168.49.2:30800" };
# (the entrypoint emits exactly this format — see docker-entrypoint.sh:17-22)

# Render-rendered Helm output: what the cluster received
helm get values ez -n ez-platform | Select-String "docsUrl"
helm template ez ./release-package/helm/ez-platform --set services.frontend.config.docsUrl=http://192.168.49.2:30800 | Select-String -Pattern "EZ_DOCS_URL" -Context 0,1
```

### Pattern 2: Language switching via querystring (not localStorage)

**What:** `src/i18n/index.ts:30-34` lists detection order as `['querystring', 'localStorage', 'navigator', 'htmlTag']`. The audit script should append `?lng=en` or `?lng=he` to the URL — no `localStorage.setItem()` needed. This is **simpler and more correct** than the CONTEXT.md narrative which suggested localStorage seeding.

```javascript
// In tmp-phase-33-audit.mjs
await page.goto(`http://localhost:7000${route}?lng=en`, { waitUntil: 'networkidle' });
```

If localStorage from a prior visit pollutes detection, the querystring still wins per i18next-browser-languagedetector's documented order.

### Pattern 3: Hebrew-leak counting on rendered text (not raw HTML)

**Why on rendered text:** Raw HTML includes translation-key strings inside script/JSON payloads (e.g., the `i18next` resource bundle is embedded in the Vite bundle as a JS string). Counting Hebrew chars in raw HTML will overcount by ~1184 keys × ~10 chars/key.

**Correct assertion in browser context:**

```javascript
const hebrewLeaks = await page.evaluate(() => {
  const HEB = /[א-תװ-״]/;  // Hebrew letters + ligatures (no emoji, no Latin, no digits)
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let count = 0;
  const samples = [];
  let node;
  while ((node = walker.nextNode())) {
    const txt = node.nodeValue?.trim() || '';
    if (HEB.test(txt)) {
      count++;
      if (samples.length < 20) samples.push(txt.slice(0, 80));
    }
  }
  return { count, samples };
});
```

**Baseline reasoning:** In `?lng=en` mode, the only Hebrew text nodes should be:
1. The `<noscript>` element body (`index.html:44` — `עליך להפעיל...`)
2. The header language-toggle label `עב` (rendered when current language is English — see `AppHeader.tsx:108-109` for the inverse pattern)

That's **2 expected text nodes** per page in English mode. Anything > 2 is a regression. In Hebrew mode, expect inverse — the language-toggle shows `EN` (Latin), so Hebrew-leak count should be very high (legitimately translated UI).

For Hebrew mode, the regression assertion flips: count **English-only labels** that should be translated. Heuristic:

```javascript
const englishLeaks = await page.evaluate(() => {
  // Words that are >=4 Latin chars with no digits and no punctuation — likely an untranslated label.
  // Exclude tech-LTR fields (regex, paths, PromQL) by skipping nodes inside .ltr-field.
  const re = /\b[A-Za-z]{4,}\b/g;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => n.parentElement?.closest('.ltr-field, code, pre') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const hits = [];
  let node;
  while ((node = walker.nextNode())) {
    const m = (node.nodeValue || '').match(re);
    if (m) hits.push(...m);
  }
  // Whitelist common acceptable Latin tokens (brand names, technical terms)
  const allow = new Set(['EZ', 'JSON', 'XML', 'CSV', 'NAS', 'FTP', 'SFTP', 'HTTP', 'JSONSchema', 'PromQL', 'Kafka', 'API', 'UTF', 'SignalR']);
  return hits.filter(h => !allow.has(h));
});
```

### Anti-Patterns to Avoid

- **Counting Hebrew chars in `await page.content()`** (raw HTML) — overcounts by the i18next resource bundle embedded as a JS string.
- **`imagePullPolicy: Always` or `IfNotPresent` with no local image** — minikube will try to pull from docker.io and fail. Use `--set services.frontend.image.pullPolicy=Never` OR rely on `IfNotPresent` AFTER confirming `minikube image load` succeeded (re-check with `minikube image ls | grep frontend`).
- **Forgetting to restart the port-forward after pod rollout** — old port-forward keeps targeting the old pod IP and serves stale content. `scripts/start-port-forwards.ps1` already does `taskkill /F /IM kubectl.exe` first — re-run it.
- **`waitUntil: 'networkidle'` for the audit on pages that poll** (e.g. dashboard with React Query polling). Use `waitUntil: 'domcontentloaded'` plus `await page.waitForSelector('.ant-layout', {state: 'visible'})` like `sanity.spec.ts:786-789` does.
- **Trusting `playwright.config.ts` baseURL** — it's hardcoded to `172.30.22.206:30080` (stale IP from a prior session). **Always pass `BASE_URL=http://localhost:7000` (or the current minikube IP NodePort) explicitly** when running for Phase 33.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image distribution to minikube | A `docker save` / SSH copy / `docker load` pipeline | `minikube image load <tag>` | Built into minikube; handles driver-specific paths (Docker, Podman, containerd) automatically |
| Polling for pod readiness | `kubectl get pod ... -o jsonpath=...` loop in PowerShell | `kubectl rollout status deployment/frontend -n ez-platform --timeout=3m` | One command, exit code reflects success, default timeout sensible |
| Templated env-var checking | grep/sed the rendered YAML | `kubectl get deployment frontend -n ez-platform -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="EZ_DOCS_URL")].value}'` | Avoids YAML parsing fragility; returns the exact value the pod sees |
| Helm release discovery | Parsing `helm list` text | `helm list -n ez-platform -o json` or just install with a fixed name (`ez`) | JSON output is stable; or sidestep entirely with idempotent `helm upgrade --install ez ...` |
| Hebrew-char detection | A bespoke `String.fromCharCode` table | `/[א-תװ-״]/u` regex on TreeWalker text nodes | Unicode block covers all Hebrew letters + ligatures; excludes Yiddish/cantillation that aren't relevant; runs in 1ms in browser |
| Screenshot organization | A custom directory walker | Playwright's `page.screenshot({ path: ... })` with manual `tmp-screenshots/phase-33/{lang}/{route}.png` | Built-in PNG, no dependencies |

**Key insight:** This phase's reliability comes from re-using the existing sanity infrastructure (`test:e2e:sanity` npm script, `start-port-forwards.ps1`) rather than reinventing it. The new code surface is just the audit `.mjs` file.

## Runtime State Inventory

Phase 33 is a deploy + validate phase. Code-level state mostly N/A, but cluster-level state matters:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — frontend pod is stateless; MongoDB data unchanged | None |
| Live service config | The 9 backend deployments retain their current image tags. The Helm install must NOT clobber them. **Verification:** before install, run `helm get values ez -n ez-platform 2>$null` — if any return, capture them as a starting point for `--values` to avoid resetting non-frontend tags. Since namespace doesn't exist right now, this is moot for the first install — but recommend a `helm upgrade --install` (idempotent) for safety in case state changes mid-session. | Capture current values if release exists; otherwise install fresh |
| OS-registered state | `start-port-forwards.ps1` spawns hidden `kubectl.exe` processes — these persist past the script's exit. Re-running the script kills them via `taskkill /F /IM kubectl.exe`. | Re-run port-forward script after the Helm install completes and the frontend pod is Ready |
| Secrets/env vars | `EZ_DOCS_URL` is set non-secret at deploy time via `--set` — no Kubernetes Secret involved. No `.env` files consumed by the production image (Vite bakes all env at build time). | None |
| Build artifacts | `src/Frontend/build/` from prior session may be stale (different commit hash). Always re-run `npm run build` to ensure the four target commits are bundled. The frontend Vite cache (`node_modules/.vite/`) is safe — Vite invalidates on input changes. | Run `npm run build` fresh; don't reuse a prior `build/` directory |

**Cluster state right now (probed live):**
- `kubectl get ns ez-platform` → NotFound — phase 33 is a **fresh install**, not an upgrade
- `helm list -n ez-platform` → empty (release `ez` does not exist)
- `minikube ip` → `192.168.49.2`
- `minikube status` → Running

This means: the first command of plan 33-01 must include `--create-namespace`, and likely needs to apply the rest of the infrastructure stack (MongoDB, Kafka, etc.) too — **CONFIRM with user**: is the goal to deploy ONLY the frontend onto an otherwise-empty cluster (which would mean sanity tests will fail because backends are absent), or should the full chart install all services together? Roadmap success-criterion 10 (`npm run test:e2e:sanity` passes) implies the full stack must be up. Plan 33-01 should install the full chart and only `--set services.frontend.*` to override the frontend image + docsUrl.

## Common Pitfalls

### Pitfall 1: minikube cannot find the locally-loaded image
**What goes wrong:** Pod stuck in `ErrImagePull` or `ImagePullBackOff` even though `minikube image load` succeeded.
**Why it happens:** Default `imagePullPolicy: IfNotPresent` works only when the image tag in the cluster matches exactly what was loaded (case-sensitive). Helm's `_helpers.tpl` `ez-platform.image` template prepends the registry (default `docker.io`) — so the rendered image becomes `docker.io/frontend:v0.5.x` but `minikube image load frontend:v0.5.x` stores it as just `frontend:v0.5.x` in some minikube driver configs.
**How to avoid:** Either (a) tag the build to match the rendered name (`docker build -t docker.io/frontend:v0.5.x .` and `minikube image load docker.io/frontend:v0.5.x`), OR (b) override the registry: `--set global.imageRegistry=""` plus `--set services.frontend.image.repository=frontend`. Verify with `minikube image ls | Select-String frontend` after loading and `kubectl describe pod -l app=frontend -n ez-platform` to see the exact image string the kubelet is trying to pull.
**Warning signs:** Pod events show `Failed to pull image "docker.io/frontend:v0.5.x"`.

### Pitfall 2: Browser caches old `/config.js` after Helm upgrade
**What goes wrong:** Audit script asserts `window.EZ_CONFIG.docsUrl === "<expected>"` but gets the previous value.
**Why it happens:** nginx config (`nginx.conf:27-30`) caches `*.js` for 7 days with `must-revalidate`. Chromium honors that with `If-None-Match` ETag, but if the file content didn't change ETags will match — except the entrypoint regenerates the file at every container start so the size/mtime should differ.
**How to avoid:** In Playwright, use `context.clearCookies()` and create a fresh `browser.newContext()` for each run. Alternatively cache-bust the request: `await page.goto('http://localhost:7000/config.js?cb=' + Date.now())` — but this only fixes the `/config.js` fetch, not the cached script execution context. Cleanest fix: `kubectl rollout restart deployment/frontend -n ez-platform; kubectl rollout status deployment/frontend -n ez-platform` between Helm changes to force a new pod (new file mtime, new ETag).
**Warning signs:** `curl -s http://localhost:7000/config.js` shows the new value but the browser sees the old one.

### Pitfall 3: Port-forward keeps targeting the old pod after rollout
**What goes wrong:** `kubectl port-forward svc/frontend 7000:8080` was started when pod A was Ready. Helm upgrade creates pod B and terminates pod A. The forward sometimes follows the svc to pod B, sometimes drops connections.
**How to avoid:** Always restart `start-port-forwards.ps1` AFTER `kubectl rollout status` returns success. The script's first action (`taskkill /F /IM kubectl.exe`) kills the old forwards, then re-establishes them against the now-healthy pod.
**Warning signs:** `curl http://localhost:7000/` returns 502 or hangs intermittently.

### Pitfall 4: Playwright `baseURL` from `playwright.config.ts` is stale
**What goes wrong:** Audit hits `http://172.30.22.206:30080` (from playwright config) instead of `http://localhost:7000`.
**How to avoid:** **Always export `BASE_URL` before running Playwright in this phase.**
```powershell
$env:BASE_URL = "http://localhost:7000"
npm run test:e2e:sanity
```
Or pass per-invocation: `BASE_URL=http://localhost:7000 npx playwright test --project=sanity`.
**Warning signs:** Test failures show connection refused or wrong-namespace responses.

### Pitfall 5: Hebrew-leak audit overcounts due to invisible nodes
**What goes wrong:** TreeWalker visits text nodes inside `<style>`, `<script>`, `<title>`, `aria-live` regions, etc.
**How to avoid:** Filter with `NodeFilter` callback to reject parents in `['SCRIPT', 'STYLE', 'NOSCRIPT']` (note: keep NOSCRIPT in the count — it's one of the two intentional baseline hits). Verify with `getBoundingClientRect()` if pure visibility matters. Recommended filter:
```javascript
acceptNode: (n) => {
  const p = n.parentElement;
  if (!p) return NodeFilter.FILTER_REJECT;
  const tag = p.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
  // NOSCRIPT: keep (it's an expected baseline hit)
  return NodeFilter.FILTER_ACCEPT;
}
```

### Pitfall 6: `helm install` with `--create-namespace` racing pod scheduler
**What goes wrong:** `helm install` returns success immediately after API objects are created, but pods are still `ContainerCreating`. Subsequent `curl` fails.
**How to avoid:** Use `--wait --timeout 5m` on the Helm command, OR always follow with `kubectl rollout status deployment/frontend -n ez-platform --timeout=3m`.

## Code Examples

### Verifying the runtime-injected config (HTTP-level)

```powershell
# After helm install + port-forward
$resp = Invoke-WebRequest -UseBasicParsing http://localhost:7000/config.js
$resp.Content
# Expected (literal output from docker-entrypoint.sh:17-22):
# // Generated at container start by docker-entrypoint.sh — do not commit edits.
# window.EZ_CONFIG = {
#   docsUrl: "http://192.168.49.2:30800"
# };

# Programmatic assert:
if ($resp.Content -notmatch 'docsUrl:\s*"http://192\.168\.49\.2:30800"') {
  throw "config.js does not contain the expected docsUrl"
}
```

### Verifying the runtime-injected config (browser-level, in Playwright)

```javascript
// After page.goto('http://localhost:7000/')
const config = await page.evaluate(() => window.EZ_CONFIG);
expect(config).toBeDefined();
expect(config.docsUrl).toBe('http://192.168.49.2:30800');
```

### Zero-external-font assertion

```powershell
# At HTTP level (raw HTML inspection):
$html = (Invoke-WebRequest -UseBasicParsing http://localhost:7000/).Content
if ($html -match 'googleapis|gstatic') {
  throw "External font CDN referenced — should be self-hosted via @fontsource/rubik"
}
```

```javascript
// In Playwright (network event capture):
const externalFontRequests = [];
page.on('request', (req) => {
  const url = req.url();
  if (/googleapis|gstatic|use\.typekit|fonts\.cdnfonts/.test(url)) {
    externalFontRequests.push(url);
  }
});
await page.goto('http://localhost:7000/', { waitUntil: 'networkidle' });
expect(externalFontRequests).toEqual([]);
```

### Help button click test (popup capture)

Reuse the `SANITY-10` pattern from `sanity.spec.ts:277-287`:
```javascript
const helpBtn = page.locator('button[aria-label="Open user guide"], button[aria-label="פתח מדריך למשתמש"]');
await expect(helpBtn).toBeVisible();
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  helpBtn.click(),
]);
await popup.waitForLoadState('domcontentloaded');
expect(popup.url()).toContain('192.168.49.2:30800');  // Helm-supplied docsUrl
expect(popup.url()).toContain('docs/user-guide/');     // path passed to openDocsInNewTab
```

### Helm install + verify command sequence (PowerShell)

```powershell
# Idempotent install — works whether release exists or not
helm upgrade --install ez ./release-package/helm/ez-platform `
  --namespace ez-platform `
  --create-namespace `
  --set services.frontend.image.tag=v0.5.x `
  --set services.frontend.image.pullPolicy=IfNotPresent `
  --set services.frontend.config.docsUrl="http://192.168.49.2:30800" `
  --wait `
  --timeout 5m

# Wait for frontend specifically (rollout-status complements --wait)
kubectl rollout status deployment/frontend -n ez-platform --timeout=3m

# Verify env var reached the container
kubectl get deployment frontend -n ez-platform `
  -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="EZ_DOCS_URL")].value}'
# Expected: http://192.168.49.2:30800

# Restart port-forwards (kills old forwards first)
powershell.exe -ExecutionPolicy Bypass -File scripts\start-port-forwards.ps1
```

## State of the Art

| Old Approach | Current Approach (2026) | Source | Impact |
|--------------|------------------------|--------|--------|
| Build-time `REACT_APP_*` env baking (require image rebuild per environment) | Runtime config via entrypoint-rewrites `config.js` loaded before bundle | Already chosen; `index.html:15` loads `/config.js` as first script; `docker-entrypoint.sh` is the writer | One image, N environments. The approach Phase 33 ships. [CITED: Vite docs explicitly recommend this pattern for runtime config — `https://vite.dev/guide/env-and-mode.html`] |
| Google Fonts CDN link in `index.html` | `@fontsource/rubik` bundled via Vite, hashed WOFF2 in `build/assets/` | `package.json:6` and Vite bundler behavior | No third-party requests, no CSP exceptions needed, no privacy concerns |
| `i18next` with hardcoded `lng: 'he'` | `i18next-browser-languagedetector` with `order: ['querystring', 'localStorage', 'navigator', 'htmlTag']` | `src/i18n/index.ts:30-34` | Shareable language links (`?lng=en`), browser-default respected, no hardcoded lock |
| `kubectl set image` for image rotation | `helm upgrade --install` with `--set services.X.image.tag=Y` | Standard 2026 Helm 3.x pattern | Captures rotation in Helm release history; rollback-able with `helm rollback ez` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The frontend deploys correctly **without** the other 9 services being present (i.e., the frontend doesn't crash-loop when MongoDB/Kafka aren't up) | Runtime State Inventory | If frontend depends on backend health for its initial render, the audit will fail with stuck spinners. Mitigation: deploy the **full** chart (all services), only override frontend image + docsUrl. ROADMAP success criterion #10 (sanity passes) implies full-stack install is required. |
| A2 | `minikube ip` returns `192.168.49.2` consistently across reboots | Cluster prep | Restart of minikube may rotate the IP. **Always re-fetch `minikube ip` at the start of plan 33-01** and pass the fresh value to `--set services.frontend.config.docsUrl=http://$(minikube ip):30800`. |
| A3 | The 8 routes used in the audit (datasources-list, datasources-new, invalid-records, alerts, dashboard, ai-assistant, admin-settings, monitoring) exist and route to non-error components in the current build | Validation Architecture | If a route 404s or shows an error boundary, leak count will be misleading (could be 0 because nothing rendered). Sanity test SANITY-20 (`sanity.spec.ts:758-818`) already validates all 10 menu routes load — run it first as a gate. |
| A4 | `?lng=en` querystring fully overrides any prior localStorage state for the entire test session | Pattern 2 | If the React app caches translations in module state, switching languages mid-session may lag. Mitigation: use a fresh `browser.newContext()` per language run (not just per route), with `storageState: undefined`. |
| A5 | The minikube IP `192.168.49.2` is reachable from the host browser for `:30800` NodePort (Docs portal) | Help button click test | On Windows with Docker Desktop's minikube driver, NodePorts may require `minikube service docs -n ez-platform --url` for a tunneled URL instead. **Verify with `curl http://192.168.49.2:30800/` from PowerShell before Playwright tries.** If unreachable, set `docsUrl` to `http://localhost:30800` (the port-forward target instead). |

## Open Questions

1. **Should Phase 33 deploy ONLY the frontend or the full chart?**
   - What we know: The `ez-platform` namespace currently doesn't exist. ROADMAP success criterion #10 requires sanity tests to pass — these need backends.
   - What's unclear: Whether the parallel session has already installed the chart and Phase 33 just overrides the frontend image, OR whether Phase 33 is the first installer.
   - Recommendation: Use `helm upgrade --install` (idempotent) and install the full chart. If a parallel session installed first and Phase 33 runs `upgrade --install` later, the second call will preserve unrelated values when only `--set services.frontend.*` is supplied. Verify before commit by running `helm get values ez -n ez-platform` after the install completes — only frontend keys should appear in the "USER-SUPPLIED VALUES" diff.

2. **Edge channel vs Chrome channel for Playwright?**
   - What we know: `playwright.config.ts` configures the sanity project with `channel: 'chrome'`. CONTEXT.md says "Edge channel confirmed working in prior session."
   - What's unclear: Whether prior session used a one-off `--channel msedge` flag or modified config.
   - Recommendation: Use Chrome for the sanity-suite invocation (matches existing config) and Chrome for the new audit script (no reason to introduce Edge). If user explicitly wants Edge, override per-invocation with `npx playwright test --headed --browser=msedge` — but verify msedge is on `PATH` first.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| minikube | All deploy plans | ✓ | v1.36.0 | — |
| Helm | All deploy plans | ✓ | v3.16.2 | — |
| kubectl | All deploy plans | ✓ | v1.33.1 | — |
| Docker (in minikube docker-env) | Image build | ✓ (via minikube driver) | — | Build on host docker, then `minikube image load` |
| Node.js | `npm run build`, Playwright | ✓ | v24.16.0 | — |
| Playwright (chromium) | Audits + sanity | ✓ | 1.49 | `npx playwright install chromium` if missing |
| Microsoft Edge | If user insists on Edge channel | UNKNOWN — not probed | — | Use Chrome (configured in sanity project) |
| Frontend `build/` directory | `docker build` input | UNKNOWN — likely stale or absent | — | `npm run build` produces it fresh |
| `ez-platform` namespace + chart | Helm upgrade path | ✗ | — | First install: `helm install --create-namespace` |

**Missing dependencies with no fallback:** None blocking — all critical tools probed Available.

**Missing dependencies with fallback:** Edge channel (use Chrome); pre-existing `build/` (rebuild).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.49 + Node.js 24.16.0 |
| Config file | `src/Frontend/playwright.config.ts` |
| Quick run command | `cd src/Frontend; $env:BASE_URL='http://localhost:7000'; npx playwright test --project=sanity --grep "SANITY-07\|SANITY-20"` |
| Full suite command | `cd src/Frontend; $env:BASE_URL='http://localhost:7000'; npm run test:e2e:sanity` |

### Phase Requirements → Test Map

| Req ID (ROADMAP success criterion) | Behavior | Test Type | Automated Command | File Exists? |
|-------|----------|-----------|-------------------|-------------|
| SC-01 | `npm run build` produces clean Vite bundle with bundled fontsource WOFF2 | smoke | `cd src/Frontend; npm run build; ls build/assets/*.woff2` | n/a (filesystem check) |
| SC-02 | Docker image builds and entrypoint writes `/usr/share/nginx/html/config.js` from `$EZ_DOCS_URL` | smoke | `docker build -t frontend:v0.5.x src/Frontend; docker run --rm -e EZ_DOCS_URL=http://test:8080 frontend:v0.5.x cat /usr/share/nginx/html/config.js` (note: container will exec nginx — use override) | n/a (shell test) |
| SC-03 | `minikube image load` succeeds; rollout shows new image | smoke | `minikube image load frontend:v0.5.x; kubectl rollout status deployment/frontend -n ez-platform` | n/a |
| SC-04 | `helm upgrade --install` succeeds; rendered Deployment shows `EZ_DOCS_URL` env var | smoke | `kubectl get deployment frontend -n ez-platform -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="EZ_DOCS_URL")].value}'` | n/a |
| SC-05 | Deployed `/config.js` contains injected docsUrl | smoke | `curl -s http://localhost:7000/config.js | Select-String "docsUrl"` | n/a |
| SC-06 | Deployed `/` returns HTML with zero Google Fonts references | smoke | `(Invoke-WebRequest -UseBasicParsing http://localhost:7000/).Content -notmatch 'googleapis|gstatic'` | n/a |
| SC-07 | English-mode audit ≤2 Hebrew text nodes per route across 8 routes | e2e | `node src/Frontend/tmp-phase-33-audit.mjs --lng=en` | ❌ Wave 0 — script to be created |
| SC-08 | Hebrew-mode audit shows no untranslated English-only labels | e2e | `node src/Frontend/tmp-phase-33-audit.mjs --lng=he` | ❌ Wave 0 — script to be created |
| SC-09 | Help / footer Documentation links navigate to configured docsUrl | e2e | Playwright test (extend `sanity.spec.ts` pattern) OR include in audit script | ✅ pattern in `sanity.spec.ts:277-287` (SANITY-10) |
| SC-10 | Sanity test suite passes against deployed cluster | e2e | `$env:BASE_URL='http://localhost:7000'; npm run test:e2e:sanity` | ✅ `tests/e2e/sanity.spec.ts` (21 tests) |

### Sampling Rate
- **Per task commit:** No commits during execution (deploy phase, not code phase).
- **Per wave merge:** Run the smoke checks (SC-05, SC-06) before moving from 33-01 to 33-02/03.
- **Phase gate:** SC-07 + SC-08 audits complete + SC-10 sanity suite green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `src/Frontend/tmp-phase-33-audit.mjs` — new multi-route audit script. Pattern: import chromium from playwright; loop 8 routes × 2 langs; capture TreeWalker text counts + console errors + network event log + screenshot; write `tmp-screenshots/phase-33/{lang}/leak-report.json` summary.
- [ ] `src/Frontend/tmp-screenshots/phase-33/{en,he}/` — output directories (create with `mkdir -p`).
- [ ] No framework install needed (Playwright already in `node_modules` per `package.json`).

## Security Domain

Phase 33 is a deploy-only phase shipping an already-reviewed React build. No new auth, sessions, access control, or crypto introduced. ASVS impact:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | unchanged from Phase 32 baseline |
| V3 Session Management | no | unchanged |
| V4 Access Control | no | unchanged |
| V5 Input Validation | no | unchanged (no new user inputs) |
| V6 Cryptography | no | unchanged |
| V12 File / Resources | partial | `docs-url.ts` consumes Helm-supplied URL; treat as **operator-trusted input** (not user input) — sanitization not required. `getDocsBaseUrl()` does `replace(/\/+$/, '')` to strip trailing slashes but does NOT validate scheme. Acceptable for v0.5.0; tighten if multi-tenant operator model emerges. |

### Known Threat Patterns for runtime-config injection

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Operator supplies malicious `docsUrl` (e.g., `javascript:alert(1)`) → XSS via Help button | Tampering | `openDocsInNewTab` uses `window.open(url, '_blank', 'noopener,noreferrer')` — `noopener` blocks `window.opener` access. Browsers block `javascript:` schemes in `window.open` since 2020. **Acceptable.** |
| `docker-entrypoint.sh` shell-injection via crafted env var | Tampering | The entrypoint runs `escape_js()` which escapes `\` and `"` only — but the value is interpolated into a heredoc, NOT executed as shell. Bash heredoc with `<<EOF` (not `<<'EOF'`) does NOT execute commands. **Acceptable** — and the value is operator-supplied via Helm, not user-supplied. |
| Browser caches stale `config.js` after Helm upgrade | Repudiation (operator can't confirm rollout) | Pod restart on `helm upgrade` regenerates the file with new mtime → new ETag → browser revalidates. Audit script can cache-bust with `?cb=Date.now()`. |

## Sources

### Primary (HIGH confidence)
- `release-package/helm/ez-platform/values.yaml:265-301` — frontend service config schema
- `release-package/helm/ez-platform/templates/deployments/frontend-deployment.yaml:50-59` — env var plumbing
- `src/Frontend/Dockerfile` — image build entrypoint
- `src/Frontend/docker-entrypoint.sh` — runtime config writer (exact output format)
- `src/Frontend/index.html:14-15, 44` — `/config.js` load order + noscript baseline text
- `src/Frontend/src/utils/docs-url.ts:55-69` — 3-tier resolution
- `src/Frontend/src/i18n/index.ts:30-34` — detection order (querystring first)
- `src/Frontend/tests/e2e/sanity.spec.ts:277-287` — SANITY-10 Help-button popup pattern (reuse template)
- `src/Frontend/tests/e2e/sanity.spec.ts:758-818` — SANITY-20 all-pages-load pattern (reuse for audit page filter)
- `scripts/start-port-forwards.ps1` — port-forward script confirmed `Frontend 7000:8080`
- Live probes via `helm version`, `minikube version`, `minikube ip`, `kubectl get ns`, `helm list -n ez-platform`

### Secondary (MEDIUM confidence)
- Vite docs runtime-config pattern recommendation — referenced from prior project knowledge of Vite ecosystem standards
- i18next-browser-languagedetector documented detection order — used in active project, observable in `src/i18n/index.ts`

### Tertiary (LOW confidence)
- None — all critical claims verified against the repository or live cluster.

## Metadata

**Confidence breakdown:**
- Helm/minikube workflow: HIGH — versions probed live; chart layout inspected
- Runtime-config injection: HIGH — every hop traced through actual repo files
- Hebrew-leak detection regex: HIGH — Hebrew Unicode block (`א-ת`) is canonical; rendered-text vs raw-HTML reasoning verified against bundle behavior
- Playwright invocation: HIGH — `playwright.config.ts` inspected; `package.json` scripts confirmed; SANITY-10 popup pattern proven in existing test
- Cluster state assumptions: HIGH — probed live, namespace confirmed absent
- Edge vs Chrome channel: LOW — CONTEXT.md says Edge worked; config says Chrome; user clarification preferred. Recommendation: use Chrome (matches config).

**Research date:** 2026-05-25
**Valid until:** 2026-06-08 (14 days — minikube/Helm releases stable; only risk is cluster IP rotation on restart)
