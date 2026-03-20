---
workflow: bmad-testarch-ci
mode: create
platform: github-actions
stack: fullstack
framework: playwright + dotnet
stepsCompleted:
  - step-01-preflight
  - step-02-pipeline-config
  - step-03-parallel-sharding
  - step-04-burn-in
  - step-05-caching
  - step-06-artifacts
  - step-07-retry-logic
  - step-08-helper-scripts
  - step-09-documentation
  - step-10-validate-and-summarize
lastStep: step-10-validate-and-summarize
completedAt: 2026-03-18
---

# CI/CD Pipeline Setup — Progress

## Status: COMPLETE

All steps executed. Pipeline file and supporting artifacts are ready.

---

## Checklist Validation

### Step 1: Preflight ✅
- Git repo initialized, remote configured
- Framework detected: Playwright (frontend E2E) + .NET xUnit (backend)
- CI platform selected: GitHub Actions

### Step 2: CI Pipeline Configuration ✅
- **File created:** `.github/workflows/test.yml`
- YAML structure validated (289 lines, 4 jobs)
- Node version: 22 (matches project package.json)
- Playwright install: Chromium only (`npx playwright install chromium --with-deps`)
- .NET version: 10.0.x

### Step 3: Parallel Sharding ✅ (adapted)
- **Backend:** 8-project matrix (`fail-fast: false`) — project-level parallelism
- **E2E:** Single P0 suite run — sharding not applied (self-hosted k8s runner; suite takes ~2.5 min, sharding overhead not worthwhile at this size)
- `fail-fast: false` confirmed on all matrix jobs

### Step 4: Burn-In ✅ (3 iterations, deviation documented)
- Burn-in job: `burn-in` — matrix `[1, 2, 3]` with `--retries=0`
- **Deviation:** Checklist default is 10 iterations. EZ uses 3 because:
  - Each run requires a live k8s cluster (~2.5 min/run)
  - 3 consecutive zero-retry passes provides sufficient flakiness signal
  - Increase via `matrix.run: [1, 2, 3, 4, 5]` if needed
- Only runs on `main` push when `EZ_K8S_RUNNER=true`
- Playwright reports uploaded for every attempt (`if: always()`)

### Step 5: Caching ✅
- NuGet: `~/.nuget/packages` keyed on `**/*.csproj` + `Directory.Packages.props`
- npm: `actions/setup-node@v4 cache: 'npm'` with `cache-dependency-path: src/Frontend/package-lock.json`
- Restore-keys defined for both
- Browser cache: Playwright Chromium reused across runs via actions/cache

### Step 6: Artifact Collection ✅
- TRX artifacts: always uploaded (needed for test-report job)
- Playwright HTML report: `if: failure()` on `e2e-p0-gate`
- Playwright burn-in reports: `if: always()` per run
- Retention: 30 days (TRX), 14 days (P0 failure), 7 days (burn-in)
- Artifact names unique: include `github.run_number` and `matrix.run`

### Step 7: Retry Logic ✅ (addressed by design)
- .NET tests: `--verbosity normal`, test runner handles transient framework errors
- E2E P0 gate: no explicit retry (Playwright's built-in retry is available but left to test-level configuration; burn-in explicitly uses `--retries=0`)
- Timeout: 15 min (unit), 15 min (P0 gate), 30 min (burn-in), 5 min (report)

### Step 8: Helper Scripts ✅
- `scripts/test-changed.sh` — auto-detects backend/frontend changes, runs relevant tests
- `scripts/ci-local.sh` — mirrors CI: runs unit tests + P0 E2E with same env vars
- `scripts/burn-in.sh` — runs P0 suite N times with `--retries=0`

### Step 9: Documentation ✅
- `docs/ci.md` — full pipeline guide (jobs, setup, local scripts, troubleshooting, badge)
- `docs/ci-secrets-checklist.md` — secrets, variables, branch protection, runner requirements

### Step 10: Security ✅
- No credentials in CI configuration
- `EZ_API_URL` passed via `vars.EZ_API_URL` (repository variable, not secret)
- All `github.event.*` data passed through `env:` intermediaries, not directly in `run:` blocks
- No debug output exposing sensitive data
- Artifact retention appropriate (not indefinite)

---

## Files Created/Modified

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/test.yml` | Created | Main CI pipeline (4 jobs) |
| `src/Frontend/package.json` | Modified | Added `test:e2e:p0` and `test:e2e:p1` scripts |
| `scripts/test-changed.sh` | Created | Run tests for changed files only |
| `scripts/ci-local.sh` | Created | Mirror CI environment locally |
| `scripts/burn-in.sh` | Created | P0 flakiness burn-in script |
| `docs/ci.md` | Created | CI pipeline documentation |
| `docs/ci-secrets-checklist.md` | Created | Secrets & branch protection guide |

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Self-hosted `[k8s]` runner for E2E | P0 tests require live NAS, NFS, Scheduling, and DataSourceManagement services — not reproducible on GitHub-hosted runners |
| `EZ_K8S_RUNNER` guard variable | Allows E2E jobs to be skipped gracefully when runner unavailable; unit tests always run |
| 3× burn-in instead of 10× | k8s cluster cost/time; 3 zero-retry passes sufficient for production signal |
| dorny/test-reporter for TRX | Native GitHub check support; no setup beyond artifact download |
| Merge-multiple TRX artifacts | Single flat directory for reporter; avoids per-project path complexity |

---

## Post-Setup Actions (User TODO)

1. [ ] Commit all new files: `git add .github/workflows/test.yml scripts/*.sh docs/ci*.md src/Frontend/package.json`
2. [ ] Push to remote: `git push`
3. [ ] Set repository variable `EZ_K8S_RUNNER = true` (if self-hosted runner exists)
4. [ ] Set repository variable `EZ_API_URL` (if API is not on localhost)
5. [ ] Configure self-hosted runner with `k8s` label (see `docs/ci.md`)
6. [ ] Open PR to trigger first CI run
7. [ ] Add required status checks to branch protection (see `docs/ci-secrets-checklist.md`)

---

## Next Recommended Workflows

1. **Test Review** (`bmad-testarch-test-review`) — audit existing tests for quality gaps
2. **Traceability** (`bmad-testarch-trace`) — map test cases to requirements
3. **NFR Assessment** (`bmad-testarch-nfr`) — performance, security, and reliability tests
