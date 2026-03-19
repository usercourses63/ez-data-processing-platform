# Phase 23: Local Sanity Deploy Script & Extended Sanity Tests — Context

**Gathered:** 2026-03-19
**Status:** Ready for planning
**Source:** User conversation — direct requirements capture

<domain>
## Phase Boundary

This phase makes the full sanity test cycle (clean deploy → seed → test) executable by the user with a single local script, without needing CI. It also extends the existing 7-test `@Sanity` suite with browser-headed mode (so the user can watch tests run) and adds new tests for the docs and help pages (verify they open and display correct content). The sanity tests are then run twice consecutively to verify consistency.

**What this phase is NOT:**
- Not a new CI job (phase 21 added the CI job; this phase improves the local developer experience)
- Not a change to the Helm chart or deployment architecture
- Not production OCP deployment

</domain>

<decisions>
## Implementation Decisions

### Single Script Trigger (locked)
- New script: `scripts/sanity-test.sh` (bash, Linux/Mac) + `scripts/sanity-test.ps1` (PowerShell, Windows)
- The script performs the full cycle in sequence:
  1. Delete the `ez-platform` namespace (wipes all old pods, services, configmaps)
  2. `minikube image prune` or equivalent to remove old application images from Minikube cache
  3. Load new images from the `dist/` deployment folder into Minikube
  4. `helm upgrade --install` to deploy all services fresh
  5. Wait for all pods ready
  6. Run DemoDataGenerator to seed data
  7. Start port-forwards
  8. Run `npm run test:e2e:sanity:headed` (browser-visible)
  9. Print pass/fail summary
- The script takes one optional argument: path to the deployment package folder (defaults to latest in `dist/`)
- If no `dist/` folder exists, the script prints instructions to run `scripts/build-all-images.sh` first

### Deployment Ends at dist/ Folder (locked)
- Build pipeline (step 1): `bash scripts/build-all-images.sh` → produces `dist/images/services/*.tar`
- Assembly pipeline (step 2): `bash scripts/assemble-package.sh` → produces `dist/deployment-VERSION-TIMESTAMP/`
- Sanity pipeline (step 3): `bash scripts/sanity-test.sh` → consumes `dist/deployment-VERSION-TIMESTAMP/`
- The three stages are separate scripts; user runs them sequentially or uses the single sanity script (step 3 only if dist/ already exists)

### Minikube Cleanup (locked)
- Before each deploy: delete namespace `ez-platform` completely (`kubectl delete namespace ez-platform --ignore-not-found`)
- Remove cached images: `minikube image rm` for all `ez-platform/*` images (or `minikube image prune --all` if available)
- Recreate namespace via `--create-namespace` flag on Helm install
- This simulates a real clean OCP install from scratch

### Browser-Headed Sanity Tests (locked)
- Add npm script: `"test:e2e:sanity:headed": "playwright test --project=sanity --headed"`
- The existing `test:e2e:sanity` (headless) stays; the new script opens a visible browser
- Playwright config: `sanity` project already uses `chromium`; `--headed` flag makes it visible
- User can watch tests execute in real time

### Extended Sanity Tests — Docs and Help Pages (locked)
- Add to `src/Frontend/tests/e2e/sanity.spec.ts`:
  - **SANITY-08: Help page opens** — Navigate to `http://<host>:30800/docs/` (docs NodePort), verify HTTP 200 and page title or heading contains "EZ" or "documentation" (case-insensitive)
  - **SANITY-09: Hebrew user guide opens** — Navigate to `http://<host>:30800/docs/user-guide-he`, verify the page loads (HTTP 200) and displays Hebrew content (contains RTL text or Hebrew characters `[\u05D0-\u05EA]`)
  - **SANITY-10: Frontend Help button links to docs** — Open the React frontend, find the Help/Documentation button/link in the header, click it, verify the resulting navigation/URL contains `:30800/docs`
- All three tests use Playwright `page` fixture (full browser, not API-only) — add to the `sanity` Playwright project with `use: { baseURL }` for the frontend and explicit docs URL from env or NodePort
- Docs URL: `http://${MINIKUBE_IP}:30800` or `http://localhost:30800` via port-forward

### Consistency Verification (locked)
- After the first full sanity run (SANITY-01 through SANITY-10), the script runs the test suite a second time automatically
- Both runs must pass for the script to exit 0
- The script prints: "Run 1: X/10 passed", "Run 2: X/10 passed" before final summary

### Claude's Discretion
- Whether to use `minikube image prune` or explicit `minikube image rm` per-image for cleanup
- Exact port-forward setup in the local script (background processes vs. kubectl wait)
- How to detect the latest `dist/` deployment folder automatically (latest mtime or sorted name)
- Whether to add a `--skip-build` flag so user can re-run tests without rebuilding images

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 21 — what already exists
- `.github/workflows/ci.yml` — CI pipeline (docker-build, package-release, sanity-deploy, release jobs)
- `scripts/build-all-images.sh` — builds 10 app images, exports tars to `dist/images/services/`
- `scripts/pull-infra-images.sh` — pulls 11 infra images, exports to `dist/images/infrastructure/`
- `scripts/assemble-package.sh` — assembles `dist/deployment-VERSION-TIMESTAMP/` folder
- `src/Frontend/tests/e2e/sanity.spec.ts` — 7 existing @Sanity tests (SANITY-01 through SANITY-07)
- `src/Frontend/playwright.config.ts` — `sanity` Playwright project definition
- `src/Frontend/package.json` — `test:e2e:sanity` npm script

### Helm chart and deployment
- `helm/ez-platform/` — full Helm chart
- `helm/ez-platform/values-local.yaml` — local/dev deploy values
- `helm/ez-platform/templates/services/services.yaml` — docs service is NodePort 30800

### DemoDataGenerator
- `tools/DemoDataGenerator/Program.cs` — CLI args: `--direct-connection --api-url http://localhost:5001`

### Docs URL logic
- `src/Frontend/src/utils/docs-url.ts` — returns `http://${hostname}:30800` for private IPs (dev/minikube)

### Infrastructure
- `CLAUDE.md` — port-forward table (18 services), Minikube cluster IP 172.30.22.206, NodePort frontend 30977

</canonical_refs>

<specifics>
## Specific Ideas

- The single script should work even if the user has not yet built images (detect missing `dist/` and print clear instructions)
- Minikube IP can be obtained via `minikube ip` in the script — don't hardcode 172.30.22.206
- Port-forwards must be cleaned up on script exit (trap EXIT signal)
- The script should print a clear URL at the end: "Frontend: http://<minikube-ip>:30977", "Docs: http://<minikube-ip>:30800"
- SANITY-10 (help button) requires a real browser interaction — use Playwright `page` not `request`
- For the docs Hebrew test, the Docusaurus page at `/docs/user-guide-he` should contain Hebrew characters — use a regex match on page content

</specifics>

<deferred>
## Deferred

- CI integration of headed tests (CI runs headless; headed is for local developer use only)
- Video recording of sanity test runs (nice-to-have, not required)
- Slack/notification on test failure (future phase)

</deferred>

---

*Phase: 23-local-sanity-deploy-script-and-extended-sanity-tests-with-browser-ui-docs-and-help-validation*
*Context gathered: 2026-03-19*
