# Phase 23: Local Sanity Deploy Script & Extended Sanity Tests - Research

**Researched:** 2026-03-19
**Domain:** Shell scripting (bash/PowerShell), Playwright browser testing, Kubernetes/Helm deployment automation
**Confidence:** HIGH

## Summary

This phase creates a single-command local sanity workflow (`scripts/sanity-test.sh` + `scripts/sanity-test.ps1`) that performs a clean Minikube deploy from `dist/` artifacts and runs the extended sanity test suite twice in headed browser mode. It also extends the existing 7 `@Sanity` Playwright tests with 3 new docs/help tests (SANITY-08 through SANITY-10).

All the building blocks already exist: `build-all-images.sh` produces image tars, `assemble-package.sh` creates deployment packages, the CI `sanity-deploy` job demonstrates the exact deploy sequence (namespace creation, parallel image load, Helm install, pod wait, port-forwards, DemoDataGenerator seeding, sanity test run), and the Playwright `sanity` project is configured in `playwright.config.ts`. The work is composing these into a local script and adding 3 new test cases.

**Primary recommendation:** Reuse the CI sanity-deploy job as the template for the local script, adapting it for interactive use (headed browser, cleanup on exit, user-friendly output).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Single script trigger: `scripts/sanity-test.sh` (bash) + `scripts/sanity-test.ps1` (PowerShell)
- Full cycle in sequence: delete namespace, prune images, load from dist/, Helm deploy, wait pods, seed DemoDataGenerator, port-forwards, run headed sanity tests, print summary
- Optional argument: path to deployment package folder (defaults to latest in `dist/`)
- If no `dist/` folder exists, print instructions to run `scripts/build-all-images.sh` first
- Deployment ends at dist/ folder (three separate stages: build, assemble, sanity)
- Minikube cleanup: delete namespace completely, remove cached images, recreate via `--create-namespace`
- Browser-headed sanity tests: add `"test:e2e:sanity:headed": "playwright test --project=sanity --headed"` npm script
- Extended sanity tests:
  - SANITY-08: Docs homepage opens at `http://<host>:30800/docs/`, HTTP 200, page contains "EZ" or "documentation"
  - SANITY-09: Hebrew user guide at `http://<host>:30800/docs/user-guide-he`, HTTP 200, contains Hebrew characters `[\u05D0-\u05EA]`
  - SANITY-10: Frontend Help button click navigates to docs URL containing `:30800/docs`
- Consistency verification: run test suite twice, both must pass, print "Run 1: X/10 passed", "Run 2: X/10 passed"

### Claude's Discretion
- Whether to use `minikube image prune` or explicit `minikube image rm` per-image for cleanup
- Exact port-forward setup in the local script (background processes vs. kubectl wait)
- How to detect the latest `dist/` deployment folder automatically (latest mtime or sorted name)
- Whether to add a `--skip-build` flag so user can re-run tests without rebuilding images

### Deferred Ideas (OUT OF SCOPE)
- CI integration of headed tests (CI runs headless; headed is for local developer use only)
- Video recording of sanity test runs (nice-to-have, not required)
- Slack/notification on test failure (future phase)
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | ^1.49.0 | Browser test framework | Already in devDependencies, `sanity` project configured |
| Helm | 3.x | Kubernetes deployment | Already used in CI and values-local.yaml |
| minikube | latest | Local K8s cluster | Project standard per CLAUDE.md |
| bash | 4+ | Cross-platform script (Linux/Mac) | CI already uses bash scripts |
| PowerShell | 5.1+ | Windows script | Project standard per existing scripts/ |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| kubectl | Namespace cleanup, pod waits, port-forwards | Core deployment operations |
| dotnet CLI | Run DemoDataGenerator | Seeding step |
| npx playwright | Test execution | Sanity test runs |

## Architecture Patterns

### Script Sequence (reuse CI sanity-deploy pattern)
```
1. Validate dist/ folder exists
2. kubectl delete namespace ez-platform --ignore-not-found
3. Clean minikube image cache (ez-platform/* images)
4. Parallel minikube image load from dist/
5. helm upgrade --install with values-local.yaml + --create-namespace
6. kubectl wait --for=condition=Ready pod --all -n ez-platform --timeout=300s
7. Start port-forwards (background, with trap for cleanup)
8. DemoDataGenerator --direct-connection --api-url http://localhost:5001
9. npm run test:e2e:sanity:headed (Run 1)
10. npm run test:e2e:sanity:headed (Run 2)
11. Print consistency report
12. Cleanup port-forwards on exit
```

### Recommended Discretion Choices

**Image cleanup:** Use `minikube image rm` for each `ez-platform/*` image explicitly rather than `minikube image prune --all`. The `prune --all` flag removes ALL unused images including infrastructure images that haven't changed. Explicit removal is safer and targets only application images.

**Port-forward setup:** Use background processes with PID tracking and `trap` for cleanup, matching the CI pattern:
```bash
PIDS=()
kubectl port-forward svc/datasource-management 5001:5001 -n ez-platform &
PIDS+=($!)
# ... all services
trap 'kill "${PIDS[@]}" 2>/dev/null' EXIT
```

**Latest dist/ detection:** Use `ls -dt dist/deployment-*/ | head -1` (sorted by modification time, newest first). This is simpler and more reliable than name-based sorting since timestamps are embedded in folder names.

**Skip-build flag:** Add `--skip-cleanup` flag (not `--skip-build`) to skip namespace deletion and image reload, jumping straight to Helm deploy. This is useful when re-running tests on an already-deployed cluster.

### Test File Structure

New tests go in the existing `src/Frontend/tests/e2e/sanity.spec.ts` file, appended after SANITY-07:

```
sanity.spec.ts
├── SANITY-01 through SANITY-07 (existing, unchanged)
├── SANITY-08: Docs homepage opens (page fixture, navigate to docs NodePort)
├── SANITY-09: Hebrew user guide (page fixture, check Hebrew regex)
└── SANITY-10: Help button click (page fixture, click QuestionCircleOutlined button)
```

### Key Technical Details

**Docs service:** NodePort 30800, Helm conditional on `.Values.services.docs.enabled`. The `values-local.yaml` includes `docs:` section so it should be enabled.

**Docs URL for tests:** Cannot use `localhost:30800` for docs tests unless port-forward is added. Currently the port-forward script does NOT include docs. Two options:
1. Add a docs port-forward: `kubectl port-forward svc/docs 30800:80 -n ez-platform &`
2. Use the Minikube IP directly: `http://$(minikube ip):30800`

Recommendation: Use port-forward approach (adds `localhost:30800`) since all other sanity tests use localhost. Add it to the script's port-forward list.

**Help button selector (SANITY-10):** The AppHeader.tsx has:
```tsx
<Button
  type="text"
  icon={<QuestionCircleOutlined />}
  onClick={() => openDocsInNewTab('docs/user-guide-he')}
  aria-label={isRTL ? 'פתח מדריך למשתמש' : 'Open user guide'}
/>
```
- Best selector: `button[aria-label="Open user guide"]` or `button[aria-label="פתח מדריך למשתמש"]`
- The `openDocsInNewTab` opens a NEW TAB (`window.open`). SANITY-10 must use `page.waitForEvent('popup')` to catch the new tab, then check its URL.
- The docs URL generated will be `http://localhost:30800/docs/user-guide-he` (from `getDocsBaseUrl()` which uses `window.location.hostname`).

**Hebrew user guide path:** The Docusaurus page is at `/docs/user-guide-he` (confirmed: `release-package/docs-docusaurus/docs/user-guide-he.mdx` exists with Hebrew content starting with `# מדריך למשתמש`).

**Frontend port:** Tests use `http://localhost:7000` (port-forwarded to `svc/frontend 7000:8080`). The CI workflow confirms this same mapping.

**DemoDataGenerator CLI:** `dotnet run --project tools/DemoDataGenerator -- --direct-connection --api-url http://localhost:5001` (confirmed from CI workflow).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image loading | Custom docker load loop | Parallel `minikube image load` with PID wait | CI already does this pattern; handles errors |
| Pod readiness | Manual polling loop | `kubectl wait --for=condition=Ready --timeout=300s` | Built-in K8s, handles edge cases |
| Port-forward cleanup | Manual process kill | `trap 'kill ...' EXIT` | Shell best practice, handles script errors/Ctrl+C |
| Hebrew character detection | Manual string inspection | Regex `/[\u05D0-\u05EA]/` | Standard Unicode range for Hebrew letters |
| New tab detection | URL string matching | Playwright `page.waitForEvent('popup')` | Proper browser event handling |

## Common Pitfalls

### Pitfall 1: Port-forward for Docs Service Missing
**What goes wrong:** Tests try `localhost:30800` but no port-forward exists for the docs service.
**Why it happens:** The existing `start-port-forwards.ps1` has 18 forwards but does NOT include docs (port 30800).
**How to avoid:** The sanity script must add `kubectl port-forward svc/docs 30800:80 -n ez-platform &` to its port-forward list.
**Warning signs:** SANITY-08/09 fail with connection refused.

### Pitfall 2: Help Button Opens New Tab (window.open)
**What goes wrong:** SANITY-10 clicks the help button and checks `page.url()` but the URL hasn't changed because `openDocsInNewTab` opens a new window.
**Why it happens:** `window.open()` creates a popup, not a navigation on the current page.
**How to avoid:** Use `const [popup] = await Promise.all([page.waitForEvent('popup'), helpButton.click()])` then check `popup.url()`.
**Warning signs:** Test passes but URL is still the frontend URL.

### Pitfall 3: Docs Service Not Enabled in Helm
**What goes wrong:** `svc/docs` does not exist after Helm deploy.
**Why it happens:** The service is conditional on `.Values.services.docs.enabled` and this key may not be explicitly set to `true` in `values-local.yaml`.
**How to avoid:** Verify `values-local.yaml` has `docs.enabled: true` or add `--set services.docs.enabled=true` to the Helm command.
**Warning signs:** `kubectl get svc -n ez-platform` shows no `docs` service.

### Pitfall 4: Namespace Deletion Hangs
**What goes wrong:** `kubectl delete namespace ez-platform` can hang for minutes if finalizers are stuck.
**Why it happens:** PVCs with finalizers, pods with long termination grace periods.
**How to avoid:** Add `--timeout=120s` and `--force --grace-period=0` as fallback. Also `--ignore-not-found` for first-run case.
**Warning signs:** Script appears hung at cleanup step.

### Pitfall 5: MongoDB Replica Set Not Initialized
**What goes wrong:** DemoDataGenerator fails to seed because MongoDB replica set is not initialized after fresh namespace creation.
**Why it happens:** Deleting namespace removes the PVC with RS config; fresh MongoDB pod needs `rs.initiate()`.
**How to avoid:** The script should include a MongoDB RS init step, or the DemoDataGenerator should handle this. Check if the Helm chart init container handles this.
**Warning signs:** DemoDataGenerator errors with "not primary" or "node not in RS" messages.

### Pitfall 6: Headed Mode on Windows with PowerShell
**What goes wrong:** `npx playwright test --project=sanity --headed` may not find Chromium.
**Why it happens:** Playwright browsers may not be installed in the local environment.
**How to avoid:** Script should run `npx playwright install chromium` before test execution.
**Warning signs:** "Executable doesn't exist" errors from Playwright.

### Pitfall 7: Playwright HTML Report Clobber Between Runs
**What goes wrong:** Run 2 overwrites Run 1 test results.
**Why it happens:** Both runs write to the same `test-results/` directory.
**How to avoid:** Use `PLAYWRIGHT_JSON_OUTPUT_FILE` env var or `--output` flag to separate results, or parse exit codes and stdout for pass counts.
**Warning signs:** Consistency report shows identical results for both runs.

## Code Examples

### SANITY-08: Docs Homepage Opens
```typescript
// Source: Project knowledge - docs service on NodePort 30800
const DOCS_URL = process.env.DOCS_URL || 'http://localhost:30800';

test('@Sanity SANITY-08: Docs homepage opens', async ({ page }) => {
  const response = await page.goto(`${DOCS_URL}/docs/`);
  expect(response?.status(), 'Docs homepage HTTP status').toBe(200);
  const content = await page.textContent('body');
  expect(
    /ez|documentation/i.test(content || ''),
    'Docs page should contain "EZ" or "documentation"'
  ).toBe(true);
});
```

### SANITY-09: Hebrew User Guide
```typescript
test('@Sanity SANITY-09: Hebrew user guide loads with Hebrew content', async ({ page }) => {
  const response = await page.goto(`${DOCS_URL}/docs/user-guide-he`);
  expect(response?.status(), 'Hebrew user guide HTTP status').toBe(200);
  const content = await page.textContent('body');
  expect(
    /[\u05D0-\u05EA]/.test(content || ''),
    'Hebrew user guide should contain Hebrew characters'
  ).toBe(true);
});
```

### SANITY-10: Help Button Click
```typescript
test('@Sanity SANITY-10: Frontend Help button navigates to docs', async ({ page }) => {
  await page.goto(FRONTEND_URL);
  const helpButton = page.locator('button[aria-label="Open user guide"], button[aria-label="פתח מדריך למשתמש"]');
  await expect(helpButton).toBeVisible();

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    helpButton.click(),
  ]);
  await popup.waitForLoadState();
  expect(popup.url()).toContain(':30800');
});
```

### Bash Script Skeleton (key sections)
```bash
#!/bin/bash
set -euo pipefail

PKG_DIR="${1:-}"
NAMESPACE="ez-platform"

# Auto-detect latest deployment package
if [ -z "$PKG_DIR" ]; then
  PKG_DIR=$(ls -dt dist/deployment-*/ 2>/dev/null | head -1)
  if [ -z "$PKG_DIR" ]; then
    echo "ERROR: No deployment package found in dist/"
    echo "Run: bash scripts/build-all-images.sh && bash scripts/assemble-package.sh"
    exit 1
  fi
fi

# Cleanup trap
PIDS=()
cleanup() { kill "${PIDS[@]}" 2>/dev/null || true; }
trap cleanup EXIT

# 1. Delete namespace
kubectl delete namespace "$NAMESPACE" --ignore-not-found --timeout=120s

# 2. Remove old application images
for img in $(minikube image ls | grep "ez-platform/"); do
  minikube image rm "$img" 2>/dev/null || true
done

# 3. Load images (parallel)
for tar in "$PKG_DIR"/images/services/*.tar "$PKG_DIR"/images/infrastructure/*.tar; do
  [ -f "$tar" ] && { minikube image load "$tar" & PIDS+=($!); }
done
for pid in "${PIDS[@]}"; do wait "$pid"; done
PIDS=()

# 4. Helm deploy
helm upgrade --install ez-platform ./helm/ez-platform \
  --namespace "$NAMESPACE" --create-namespace \
  --values helm/ez-platform/values-local.yaml \
  --wait --timeout 15m

# 5. Wait for pods
kubectl wait --for=condition=Ready pod --all -n "$NAMESPACE" --timeout=300s

# 6. Port-forwards (including docs on 30800)
kubectl port-forward svc/frontend 7000:8080 -n "$NAMESPACE" &
PIDS+=($!)
# ... all other services + docs
kubectl port-forward svc/docs 30800:80 -n "$NAMESPACE" &
PIDS+=($!)
sleep 10

# 7. Seed
dotnet run --project tools/DemoDataGenerator -- --direct-connection --api-url http://localhost:5001

# 8. Ensure Playwright installed
cd src/Frontend
npx playwright install chromium

# 9. Run twice
RUN1_EXIT=0; RUN2_EXIT=0
npm run test:e2e:sanity:headed || RUN1_EXIT=$?
npm run test:e2e:sanity:headed || RUN2_EXIT=$?

# 10. Report
echo "Run 1: $([ $RUN1_EXIT -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
echo "Run 2: $([ $RUN2_EXIT -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
exit $(( RUN1_EXIT + RUN2_EXIT ))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual kubectl deploy steps | CI sanity-deploy job (Phase 21) | 2026-03-18 | Automated in CI but no local equivalent |
| Headless-only sanity tests | This phase adds headed mode | Phase 23 | User can watch tests execute |
| 7 sanity tests (API + frontend title) | 10 sanity tests (+docs, Hebrew, help) | Phase 23 | Better coverage of docs integration |

## Open Questions

1. **MongoDB RS Init After Namespace Delete**
   - What we know: Deleting namespace removes MongoDB PVC. Fresh pod needs `rs.initiate()`.
   - What's unclear: Does the Helm chart include an init container that handles RS init automatically?
   - Recommendation: Check the MongoDB deployment template. If no init container, add `kubectl exec mongodb-0 -n ez-platform -- mongosh --eval "rs.initiate()"` step after pod readiness wait.

2. **Docs Service Enabled Flag**
   - What we know: `values-local.yaml` has a `docs:` section with resources but no explicit `enabled: true`.
   - What's unclear: Whether the default in `values.yaml` is `true` or `false`.
   - Recommendation: Check `helm/ez-platform/values.yaml` for the default. If not explicitly true, add `--set services.docs.enabled=true` to the Helm command or update `values-local.yaml`.

3. **Pass Count Extraction for Consistency Report**
   - What we know: User wants "Run 1: X/10 passed" format.
   - What's unclear: Playwright CLI output format for extracting pass counts.
   - Recommendation: Use `--reporter=json` to a temp file and parse `suites[].specs[].tests[].results[].status`, or use `--reporter=line` and grep for the summary line. The JSON reporter is already configured in playwright.config.ts with `outputFile: 'test-results/results.json'`.

## Sources

### Primary (HIGH confidence)
- `src/Frontend/tests/e2e/sanity.spec.ts` - existing 7 sanity tests, exact patterns
- `src/Frontend/playwright.config.ts` - sanity project config, reporter settings
- `.github/workflows/ci.yml` lines 276-409 - CI sanity-deploy job (exact deploy sequence)
- `scripts/build-all-images.sh` - image build pattern, 10 services
- `scripts/assemble-package.sh` - package assembly structure
- `helm/ez-platform/templates/services/services.yaml` - docs service NodePort 30800
- `src/Frontend/src/components/layout/AppHeader.tsx` lines 103-116 - Help button implementation
- `src/Frontend/src/utils/docs-url.ts` - docs URL generation logic
- `release-package/docs-docusaurus/docs/user-guide-he.mdx` - Hebrew content confirmed

### Secondary (MEDIUM confidence)
- `scripts/start-port-forwards.ps1` - existing port-forward pattern (does NOT include docs)
- `helm/ez-platform/values-local.yaml` - local deploy values

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all tools already in project, no new dependencies
- Architecture: HIGH - CI sanity-deploy job provides exact template
- Pitfalls: HIGH - identified from reading actual code and deployment patterns
- Test patterns: HIGH - existing sanity tests provide exact style to follow

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
