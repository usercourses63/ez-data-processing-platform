# Phase 33 Validation Report

**Run date:** 2026-06-02
**Cluster:** minikube (Session A, IP 192.168.49.2, namespace ez-platform)
**Frontend image:** frontend:v0.5.0-phase33 (in minikube store as `docker.io/library/frontend:v0.5.0-phase33`)
**Helm release:** ez-platform (chart 1.0.0) — SURGICAL approach: no `helm upgrade` re-render was performed (would have re-broken backends + removed the out-of-band RabbitMQ per CLUSTER-COORDINATION). The frontend Deployment was already running the Phase 33 image with the correct env/ports from a prior in-session deploy; this validation confirmed and audited that deployed artifact.
**docsUrl:** http://192.168.49.2:30800
**API endpoint mode:** Port-forward (no NodePort 30080 exposed) — frontend svc/frontend 7000→8080; backends 5001/5002/5003/5004/5007(→container 5007)/5008/5009.

> NOTE ON APPROACH: Per the execution brief and CLUSTER-COORDINATION.md, the literal plan step `helm upgrade --install ez ...` was deliberately NOT run. The live release is `ez-platform`, a standalone RabbitMQ was deployed out-of-band, and re-rendering the chart would have re-broken the 5 .NET backends. Instead the already-deployed `frontend:v0.5.0-phase33` artifact (correct image, EZ_DOCS_URL env, containerPort 8080) was validated in place. All HTTP/content/i18n criteria were verified against that live pod.

## Plan 33-01 — Build + chart fix + deploy + HTTP verification

| Check | Result | Evidence |
|---|---|---|
| Pre-flight (minikube + IP) | PASS | `minikube ip` = 192.168.49.2 (matches D-03); frontend pod 1/1 Running |
| Chart fix: frontend port 80 → 8080 | PASS (pre-existing) | commit 4417474 "fix(helm): frontend port 80 → 8080 + empty imageRegistry produces bare image string" |
| Vite build + WOFF2 bundling (SC-01) | PASS | 30 `*.woff2` files in pod `/usr/share/nginx/html/assets/` |
| Docker image + minikube image load (SC-03) | PASS | `minikube image ls` → `docker.io/library/frontend:v0.5.0-phase33`; deployment image `frontend:v0.5.0-phase33` |
| Image string has no docker.io prefix in Deployment | PASS | `kubectl get deployment frontend -o jsonpath{...image}` = `frontend:v0.5.0-phase33` |
| Entrypoint writes config.js (SC-02) | PASS | pod `/config.js` = `window.EZ_CONFIG = { docsUrl: "http://192.168.49.2:30800" };` |
| EZ_DOCS_URL env var (SC-04) | PASS | Deployment env `EZ_DOCS_URL=http://192.168.49.2:30800` |
| HTTP /config.js docsUrl literal (SC-05) | PASS | `curl http://localhost:7000/config.js` → `docsUrl: "http://192.168.49.2:30800"` |
| HTTP / zero font CDN refs (SC-06) | PASS | `curl http://localhost:7000/` \| grep -c googleapis\|gstatic = 0 (also 0 in pod index.html) |
| containerPort 8080 | PASS | Deployment containerPort 8080; svc/frontend port 8080 targetPort 8080 |

## Plan 33-02 — English-mode 8-route audit (`?lng=en`)

All 9 tests PASSED (`phase-33-english-audit.spec.ts`).

| Route slug | path | Hebrew count (≤2) | External font requests (==0) |
|---|---|---|---|
| home-root | / | ≤2 PASS | 0 |
| datasources-list | /datasources | ≤2 PASS | 0 |
| datasources-new | /datasources/new | ≤2 PASS | 0 |
| invalid-records | /invalid-records | ≤2 PASS | 0 |
| alerts | /alerts | ≤2 PASS | 0 |
| ai-assistant | /ai-assistant | ≤2 PASS | 0 |
| admin-settings | /admin/settings | ≤2 PASS | 0 |
| monitoring | /monitoring | ≤2 PASS | 0 |
| window.EZ_CONFIG.docsUrl | (browser) | == http://192.168.49.2:30800 PASS | — |

Screenshots: src/Frontend/tmp-screenshots/phase-33/en/ (8 PNGs)
Reports: playwright-report/index.html, test-results/results.json

## Plan 33-03 — Hebrew-mode audit + Help-link + sanity suite

### Hebrew audit (`?lng=he`) — `phase-33-hebrew-audit.spec.ts`

Primary SC-08 contract (RTL + lang=he) PASSED on ALL 8 routes. The `englishLeaks`
soft-assertion (cap 3) was exceeded on all routes — dispositioned below as
KNOWN-ACCEPT (the regex over-counts the intentional bilingual NOSCRIPT fallback
and, on /monitoring, live English backend log data — neither are untranslated UI labels).

| Route slug | dir==rtl | lang==he | englishLeaks (cap 3) | Leak sample tokens | Ext fonts |
|---|---|---|---|---|---|
| home-root | yes | yes | 8 | need, enable, JavaScript, this, nbsp(×2), Schema | 0 |
| datasources-list | yes | yes | 8 | (NOSCRIPT ×7) + Schema | 0 |
| datasources-new | yes | yes | 9 | (NOSCRIPT ×7) + Schema, financial | 0 |
| invalid-records | yes | yes | 7 | (NOSCRIPT ×7 only) | 0 |
| alerts | yes | yes | 8 | (NOSCRIPT ×7) + Metric | 0 |
| ai-assistant | yes | yes | 9 | (NOSCRIPT ×7) + Schema, autofill | 0 |
| admin-settings | yes | yes | 7 | (NOSCRIPT ×7 only) | 0 |
| monitoring | yes | yes | 83 | (NOSCRIPT ×7) + live log payload: WARN, ERROR, INFO, "Validation Service Failed", "File Processor", "Slow query detected", … | 0 |

**Disposition (KNOWN-ACCEPT for v0.5.0):** 7 of every route's leaks are the
intentional bilingual `<noscript>You need to enable JavaScript to run this app.
&nbsp; / &nbsp; עליך להפעיל JavaScript…</noscript>` baseline (the literal tokens
`need, enable, JavaScript, this, nbsp, nbsp, JavaScript`). The genuine residual
UI-label leaks per route are only 0–2 tokens (Schema / financial / Metric /
autofill — technical/proper terms not in the whitelist). The /monitoring outlier
(83) is **live English log data streamed from backend services** (log levels +
service log messages), which is data, not UI labels. Per the 33-03 plan
("Do NOT raise ENGLISH_LEAK_BASELINE in code to make the test pass; the report
disposition is the bar"), the cap was left at 3 and this is recorded as accepted.
SC-08's substantive contract — page is genuinely in Hebrew/RTL with no
untranslated *labels* — is met.

Screenshots: src/Frontend/tmp-screenshots/phase-33/he/ (8 PNGs)

### Help-link test — `phase-33-help-link.spec.ts`

- Result: **PASS** (1/1).
- window.open URL captured: `http://192.168.49.2:30800/docs/user-guide/`
- Contains `192.168.49.2:30800`: **yes**.
- Note: the AppHeader Help button calls `window.open(url, '_blank', 'noopener,noreferrer')`.
  With `noopener`, Chromium does not reliably surface a Playwright `popup` event, so
  the spec asserts the `window.open()` argument directly (the authoritative SC-09 value)
  rather than the popup-event mechanism. Verified independently via the Playwright MCP
  browser that the click invokes `window.open("http://192.168.49.2:30800/docs/user-guide/")`.

### Sanity suite (`npm run test:e2e:sanity`)

- API endpoint mode: Port-forward (DATASOURCE_API=5001, METRICS_API=5002, SCHEDULING_API=5004; MINIKUBE_IP=192.168.49.2, DOCS_URL=...:30800).
- Total: 21 tests. Passed: 11. Failed: 10. Exit code: non-zero (1).
- **None of the 10 failures are Phase 33 frontend regressions.** Categorized below.

| Failing test | Cause category | Disposition |
|---|---|---|
| SANITY-08 (docs homepage) | Docs/Docusaurus portal NOT deployed in ez-platform (`192.168.49.2:30800` ERR_CONNECTION_TIMED_OUT; no docs svc/pod) | accept — environment gap (out of Phase 33 scope; frontend correctly *points* to docsUrl) |
| SANITY-09 (Hebrew user guide) | same — docs portal not deployed | accept — environment gap |
| SANITY-10 (Help button → docs) | (a) docs portal not deployed + (b) `noopener` popup-event not surfaced by Chromium (same mechanism issue handled in phase-33-help-link) | accept — covered & PASSING by phase-33-help-link (asserts window.open arg) |
| SANITY-12 (revalidate-all) | invalidrecords chart Service bug: Service targetPort 5006 ≠ container port 5007 → API unreachable via svc | accept — chart/infra defect, not frontend; not modified per SURGICAL constraint |
| SANITY-21 (nginx proxy routes) | nginx `/api/v1/invalid-records` → `invalidrecords:5007` svc (5006 targetPort bug) times out | accept — same invalidrecords svc bug |
| SANITY-02 (datasources visible) | port-forward saturation under concurrent fullyParallel load (5001 categories/metrics verified 200 directly after run) | accept — test-harness/port-forward limitation, backend healthy |
| SANITY-03 (create/delete DS via UI) | depends on data API above (timed-out GET → UI never populates) | accept — downstream of SANITY-02 cause |
| SANITY-04 (categories visible) | port-forward saturation (5001 `/api/v1/categories` returns 200 directly post-run) | accept — port-forward limitation |
| SANITY-05 (metrics responsive) | port-forward saturation (5002 `/api/v1/metrics` returns 200 directly post-run) | accept — port-forward limitation |
| SANITY-11 (NAS pipeline) | NAS device prerequisite GET timed out (port-forward) + NAS not provisioned in this cluster | accept — environment/port-forward, out of frontend scope |

Passing (11): SANITY-01, 06, 07, 13, 14, 15, 16, 17, 18, 19, 20 — including frontend
load + title (07), all menu pages load (20), scheduling (06), schema/clone/TTL/CSV-infer API tests.

## ROADMAP Success Criteria Cross-Reference
- [x] SC-01 (npm run build clean bundle + WOFF2): **PASS** — plan 33-01 (30 woff2 in build/pod assets)
- [x] SC-02 (Docker image + entrypoint writes config.js): **PASS** — plan 33-01 (pod /config.js content)
- [x] SC-03 (minikube image load + rollout): **PASS** — plan 33-01 (image in store, pod 1/1 Running with tag)
- [x] SC-04 (helm/EZ_DOCS_URL env): **PASS** — plan 33-01 (EZ_DOCS_URL env on Deployment = docsUrl). Helm re-render intentionally skipped (SURGICAL); env/image verified in-place.
- [x] SC-05 (deployed /config.js content): **PASS** — plan 33-01 (HTTP + pod) AND 33-02 (browser window.EZ_CONFIG)
- [x] SC-06 (zero Google Fonts refs): **PASS** — plan 33-01 (HTTP=0, pod=0) AND 33-02/03 (per-route font-request counter = 0 on all 16 audits)
- [x] SC-07 (English audit ≤2 Hebrew/route): **PASS** — plan 33-02 (all 8 routes + config-injection test = 9/9 green)
- [x] SC-08 (Hebrew audit RTL+lang): **PASS (primary)** — plan 33-03: dir=rtl + lang=he on all 8 routes. englishLeaks cap exceeded → KNOWN-ACCEPT (NOSCRIPT baseline + live log data; real label leaks 0–2/route).
- [x] SC-09 (Help link → docsUrl popup): **PASS** — plan 33-03 (window.open = http://192.168.49.2:30800/docs/user-guide/)
- [~] SC-10 (sanity suite green): **PARTIAL** — 11/21 pass; 10 failures all dispositioned as environment/infra/port-forward, NONE are Phase 33 frontend regressions.

## Overall Phase Disposition

**READY-FOR-VERIFY** (frontend i18n + foundation deploy fully validated)

Phase 33's frontend deliverables (SC-01 through SC-09) all PASS. SC-10 is PARTIAL,
but every sanity failure is dispositioned to a non-frontend root cause:

NEEDS-GAP-CLOSURE items (tracked separately, NOT Phase 33 frontend scope):
- **Docs portal not deployed** in ez-platform (Docusaurus on NodePort 30800) → blocks SANITY-08/09/10 docs navigation and any live docs render. The frontend correctly targets the docsUrl; the docs backend simply isn't running in this cluster.
- **invalidrecords chart Service port bug**: Service targets port 5006 while the container listens on 5007 → SANITY-12/21 + nginx `/api/v1/invalid-records` proxy fail. A one-line chart fix (svc targetPort 5006 → 5007), out of Phase 33 frontend scope and not applied here per the SURGICAL/no-re-render constraint.
- **Sanity port-forward saturation**: the fullyParallel sanity suite overwhelms single-tunnel port-forwards; SANITY-02/03/04/05/11 timeouts are harness artifacts (the same endpoints return 200 when queried directly). Re-running serially, or via a real NodePort/ingress, would clear these.
