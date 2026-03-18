# CI Secrets & Variables Checklist

Use this checklist when setting up or auditing the EZ Platform CI pipeline.

**Platform:** GitHub Actions
**Config file:** `.github/workflows/test.yml`

---

## Repository Variables

Variables are non-sensitive configuration values stored in GitHub Actions.
Location: **Settings → Secrets and variables → Actions → Variables tab**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EZ_K8S_RUNNER` | Required for E2E | _(unset = skip E2E)_ | Set to `true` to enable `e2e-p0-gate` and `burn-in` jobs. Leave unset to run only .NET unit tests. |
| `EZ_API_URL` | Optional | `http://localhost:5001` | DataSourceManagement API base URL accessible from the self-hosted runner. Override when API is not on localhost (e.g., `http://10.0.0.5:5001`). |

---

## Repository Secrets

Secrets are sensitive values stored encrypted in GitHub.
Location: **Settings → Secrets and variables → Actions → Secrets tab**

The current pipeline has **no required secrets**. The pipeline uses only:
- Publicly-accessible localhost endpoints (via self-hosted runner port-forwards)
- No external service credentials
- No deployment tokens

> If you add contract testing (Pact) in the future, add:
>
> | Secret | Description |
> |--------|-------------|
> | `PACT_BROKER_URL` | Pact Broker base URL |
> | `PACT_BROKER_TOKEN` | Read/write token for Pact Broker |

---

## Self-Hosted Runner Requirements

The runner executing `[self-hosted, k8s]` jobs must have:

- [ ] Runner registered with GitHub Actions and labeled `k8s`
- [ ] Network access to EZ Platform namespace in Kubernetes cluster
- [ ] Port-forwards active for all 18 services (run `scripts/start-port-forwards.ps1`)
- [ ] Node.js 22 installed
- [ ] npm available
- [ ] Playwright Chromium browser cached (`npx playwright install chromium`)
- [ ] No extra secrets required — runner uses localhost access

---

## Verification Steps

After initial setup, verify the pipeline works:

- [ ] Push a commit or open a PR to `main`
- [ ] Confirm `unit-tests` job appears and all 8 matrix legs execute
- [ ] Confirm `test-report` job runs and publishes results in the Actions summary
- [ ] If `EZ_K8S_RUNNER=true`: confirm `e2e-p0-gate` job starts on the self-hosted runner
- [ ] If `EZ_K8S_RUNNER=true` and push to `main`: confirm `burn-in` runs 3× with `--retries=0`
- [ ] Check that a PR that fails tests blocks merge (branch protection rules below)

---

## Recommended Branch Protection Rules

Settings → Branches → Add rule for `main`:

- [ ] **Require a pull request before merging**
- [ ] **Require status checks to pass before merging**
  - Required checks: `.NET Tests — Shared`, `.NET Tests — Integration`, `.NET Tests — ValidationService`, `.NET Tests — OutputService`, `.NET Tests — SchedulingService`, `.NET Tests — DataSourceManagement`, `.NET Tests — InvalidRecordsService`, `.NET Tests — MetricsConfiguration`
  - Optional (when runner available): `E2E — P0 Smoke Gate (k8s)`
- [ ] **Require branches to be up to date before merging**
- [ ] **Do not allow bypassing the above settings** (optional, for strict teams)

> The `E2E — P0 Smoke Gate` check only runs when `EZ_K8S_RUNNER=true`. If the
> self-hosted runner is unavailable, the job is skipped (not failed). Consider
> whether to make E2E a required check based on runner availability SLA.

---

## Secret Rotation

No time-limited secrets are currently in use. If Pact Broker tokens are added,
rotate them every 90 days and update the GitHub secret in:
Settings → Secrets → `PACT_BROKER_TOKEN` → Update secret.

---

## Audit Log

| Date | Action | Who |
|------|--------|-----|
| 2026-03-18 | Initial CI pipeline created | Claude (bmad-testarch-ci) |
| | | |
