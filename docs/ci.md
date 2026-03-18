# EZ Platform — CI/CD Pipeline Guide

## Overview

The CI pipeline runs on GitHub Actions and validates every push and pull request
targeting `main`. It consists of four jobs:

| Job | Runner | Trigger | Purpose |
|-----|--------|---------|---------|
| `unit-tests` | `ubuntu-latest` | All pushes/PRs | .NET tests across all 8 projects |
| `e2e-p0-gate` | `[self-hosted, k8s]` | When `EZ_K8S_RUNNER=true` | Playwright P0 smoke suite |
| `burn-in` | `[self-hosted, k8s]` | `main` push + k8s runner | P0 × 3 with `--retries=0` |
| `test-report` | `ubuntu-latest` | Always (after unit-tests) | TRX → GitHub step summary |

**Config file:** `.github/workflows/test.yml`

---

## Prerequisites

### GitHub Repository Settings

1. **Repository variable** — create `EZ_K8S_RUNNER = true` to enable E2E jobs:
   - Settings → Secrets and variables → Actions → Variables → New repository variable

2. **Repository variable (optional)** — `EZ_API_URL` overrides the default API URL:
   - Default: `http://localhost:5001`

3. **Self-hosted runner** with label `k8s` — must have access to a live EZ Platform
   Kubernetes cluster. See [Self-Hosted Runner Setup](#self-hosted-runner-setup).

### Environment Requirements

| Component | Version |
|-----------|---------|
| .NET SDK | 10.0.x |
| Node.js | 22 |
| Playwright | installed via `npx playwright install chromium` |

---

## Jobs Reference

### `unit-tests`

Runs all 8 .NET test projects in parallel using a matrix strategy.

```yaml
matrix:
  - Shared
  - Integration          # --filter "TestCategory!=Infrastructure"
  - ValidationService
  - OutputService
  - SchedulingService
  - DataSourceManagement
  - InvalidRecordsService
  - MetricsConfiguration
```

**Cache:** NuGet packages keyed on `**/*.csproj` + `Directory.Packages.props`.

**Artifacts:** TRX files uploaded as `trx-{name}-{run_number}` (retained 30 days).

> The `Integration` leg skips tests tagged `TestCategory=Infrastructure` since
> those require live MongoDB/Kafka instances unavailable on GitHub-hosted runners.

### `e2e-p0-gate`

Runs the Playwright `@P0` test suite against a live cluster. Only executes when
the repository variable `EZ_K8S_RUNNER` is set to `true` and a self-hosted runner
with the `k8s` label is registered.

**Test command:** `npm run test:e2e:p0` (= `playwright test --grep @P0`)

**Environment variables passed:**
- `BASE_URL` — Frontend URL (default `http://localhost:7000`)
- `EZ_API_URL` — DataSourceManagement API (from repo variable or default)
- `SCHEDULING_API_URL` — Scheduling API (default `http://localhost:5004`)

**Artifacts:** Playwright HTML report uploaded on failure (retained 14 days).

### `burn-in`

Runs the P0 suite 3 times on `main` with `--retries=0`. Any non-deterministic
failure is immediately visible. Depends on `e2e-p0-gate` passing first.

> The checklist default is 10 iterations. EZ uses 3 because each run requires
> a live k8s cluster and takes ~2.5 min. Three consecutive passes with zero
> retries provides strong flakiness signal without excessive cluster load.
> Increase via the matrix if needed: `matrix.run: [1, 2, 3, 4, 5]`.

### `test-report`

Aggregates all TRX artifacts and publishes a formatted test report as a GitHub
step summary and check using `dorny/test-reporter@v1`. Always runs even when
`unit-tests` fails.

---

## Self-Hosted Runner Setup

The `e2e-p0-gate` and `burn-in` jobs require a runner with:

1. Labels: `self-hosted`, `k8s`
2. Network access to the EZ Platform cluster (all ports in
   `scripts/start-port-forwards.ps1`)
3. Node.js 22, npm, `npx`
4. Playwright Chromium dependencies (`npx playwright install chromium --with-deps`)

**Register the runner:**

```bash
# In GitHub: Settings → Actions → Runners → New self-hosted runner
# Follow the instructions for your OS, then add label "k8s"
./config.sh --url https://github.com/ORG/EZ --token TOKEN --labels k8s
./run.sh
```

**Port forwarding:** start port forwards before runner begins:

```powershell
powershell.exe -ExecutionPolicy Bypass -File "scripts/start-port-forwards.ps1"
```

---

## Running Locally

Mirror the CI environment using the helper scripts:

```bash
# Run all tests (unit + P0 E2E)
bash scripts/ci-local.sh all

# Run .NET tests only
bash scripts/ci-local.sh unit

# Run P0 E2E only (requires live cluster + port-forwards)
bash scripts/ci-local.sh p0

# Run only tests relevant to your changed files
bash scripts/test-changed.sh

# Burn-in: 3× P0 runs with --retries=0
bash scripts/burn-in.sh
bash scripts/burn-in.sh 5   # custom iteration count
```

---

## Concurrency

Pull request runs are cancelled when a new push arrives on the same branch:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}-...
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

Pushes to `main` are **not** cancelled (each run gets a unique group ID).

---

## Adding New Tests

### Backend test project

1. Create project under `tests/`
2. Add entry to the matrix in `.github/workflows/test.yml`
3. If tests require live infra, add `[TestCategory("Infrastructure")]` attribute

### New E2E test

1. Create spec under `src/Frontend/tests/e2e/`
2. Tag with `@P0` if it should be a merge gate
3. Tag with `@P1` for broader smoke coverage
4. The `test:e2e:p0` and `test:e2e:p1` npm scripts pick up tags automatically

---

## Troubleshooting

**E2E job skipped?**
→ Check `EZ_K8S_RUNNER` repository variable is set to `"true"` (string).

**Tests fail in CI but pass locally?**
→ Run `bash scripts/ci-local.sh p0` to reproduce with the same environment.
→ Check port-forwards are active: `powershell.exe -File scripts/start-port-forwards.ps1`

**NuGet cache miss every run?**
→ Verify `Directory.Packages.props` hasn't been modified between runs.
→ Check cache key: `nuget-{runner.os}-{hash of *.csproj + Directory.Packages.props}`

**TRX report missing?**
→ `test-report` job needs the `trx-*-{run_number}` artifacts from `unit-tests`.
→ If unit-tests was skipped/cancelled, no TRX is produced.

**Playwright report not uploaded?**
→ HTML report is only uploaded on `failure()`. Check the job status.

---

## Status Badge

Add to your README:

```markdown
![Test Pipeline](https://github.com/ORG/EZ/actions/workflows/test.yml/badge.svg)
```

Replace `ORG` with your GitHub organization or username.
