---
phase: 21-release-package-and-ci-pipeline
verified: 2026-03-18T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
---

# Phase 21: Release Package & CI Deployment Pipeline Verification Report

**Phase Goal:** Automate versioned offline deployment package production and CI deployment pipeline with sanity gate
**Verified:** 2026-03-18
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CI builds 10 app images from source and exports .tar files | ✓ VERIFIED | `scripts/build-all-images.sh` has 10 `ez-platform/` entries; `docker-build` job in ci.yml calls `bash scripts/build-all-images.sh $VERSION $COMMIT_SHA` |
| 2 | CI pulls 11 infra images and saves .tar files | ✓ VERIFIED | `scripts/pull-infra-images.sh` has all 11 IMAGES entries (mongo, kafka, zookeeper, rabbitmq, hazelcast, elasticsearch, prometheus, grafana, jaeger, otel, fluent-bit); `package-release` job calls it |
| 3 | CI assembles versioned timestamped deployment folder uploaded as artifact with 90-day retention | ✓ VERIFIED | `scripts/assemble-package.sh` names folder `deployment-${VERSION}-${TIMESTAMP}`; `package-release` job uploads with `retention-days: 90` (ci.yml line 281) |
| 4 | CI deploys via Helm on self-hosted runner, seeds with DemoDataGenerator, runs @Sanity gate | ✓ VERIFIED | `sanity-deploy` job: gated by `vars.EZ_K8S_RUNNER == 'true'`, runs `helm upgrade --install`, `--direct-connection --api-url http://localhost:5001`, then `npm run test:e2e:sanity` |
| 5 | 7 @Sanity Playwright tests exist covering health, data, CRUD, categories, metrics, scheduling, and frontend | ✓ VERIFIED | `src/Frontend/tests/e2e/sanity.spec.ts` has 7 tests SANITY-01 through SANITY-07; no NAS/SFTP/cross-cluster deps |
| 6 | Tagged GitHub release created with CHANGELOG excerpt and deployment zip attached | ✓ VERIFIED | `release` job in ci.yml: `if: startsWith(github.ref, 'refs/tags/v')`, calls `gh release create`, downloads package zip, attaches it; `release-package/CHANGELOG.md` has `[v0.2.0]` entry |

**Score:** 6/6 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/build-all-images.sh` | Build 10 app images, export tars | ✓ VERIFIED | `#!/bin/bash`, `set -euo pipefail`, 10 `ez-platform/` service entries, `docker save` to `dist/images/services/` |
| `scripts/pull-infra-images.sh` | Pull 11 infra images, export tars | ✓ VERIFIED | `#!/bin/bash`, `set -euo pipefail`, 11 infrastructure image entries matching IMAGE-MANIFEST.txt exactly |
| `scripts/assemble-package.sh` | Assemble canonical deployment folder | ✓ VERIFIED | `deployment-${VERSION}-${TIMESTAMP}` naming; copies services+infra tars, helm chart, values-local.yaml, install.ps1, generates install.sh, copies IMAGE-MANIFEST.txt and DEPLOYMENT-GUIDE.md; writes to `$GITHUB_OUTPUT` |
| `.github/workflows/ci.yml` | docker-build + package-release + sanity-deploy + release jobs | ✓ VERIFIED | All 4 new jobs present (lines 199, 239, 283, 426); all 5 original jobs (build, test, performance, docker, helm-validate) preserved |
| `src/Frontend/tests/e2e/sanity.spec.ts` | 7 @Sanity tests SANITY-01–SANITY-07 | ✓ VERIFIED | Exactly 7 test blocks, uses Playwright `request` fixture, no NAS/SFTP/simulator imports |
| `src/Frontend/playwright.config.ts` | `sanity` project definition | ✓ VERIFIED | `name: 'sanity'`, `testMatch: ['**/sanity.spec.ts']`, `timeout: 60000`, `fullyParallel: false` |
| `src/Frontend/package.json` | `test:e2e:sanity` npm script | ✓ VERIFIED | `"test:e2e:sanity": "playwright test --project=sanity"` at line 48 |
| `release-package/CHANGELOG.md` | v0.2.0 release notes at top | ✓ VERIFIED | `## [v0.2.0] - 2026-03-18` at line 8; Added/Changed/Fixed sections covering all v0.2 milestone features; `[v0.1.1-rc2]` entry preserved |
| `release-package/README.md` | Offline Helm deployment guide | ✓ VERIFIED | "Offline / Air-Gapped Deployment" section at line 385; package structure, Windows + Linux install commands, OCP note |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ci.yml` (docker-build) | `scripts/build-all-images.sh` | `bash scripts/build-all-images.sh $VERSION $COMMIT_SHA` | ✓ WIRED | ci.yml lines 226–229 |
| `ci.yml` (package-release) | `scripts/pull-infra-images.sh` | `bash scripts/pull-infra-images.sh "dist/images/infrastructure"` | ✓ WIRED | ci.yml lines 258–260 |
| `ci.yml` (package-release) | `scripts/assemble-package.sh` | `bash scripts/assemble-package.sh $VERSION "dist"` | ✓ WIRED | ci.yml lines 264–266 |
| `ci.yml` (package-release) | deployment zip artifact | `actions/upload-artifact@v4 with retention-days: 90` | ✓ WIRED | ci.yml line 281 |
| `package-release` outputs | `sanity-deploy` + `release` artifact download | `needs.package-release.outputs.pkg_name` used in both jobs | ✓ WIRED | ci.yml lines 308, 466 |
| `ci.yml` (sanity-deploy) | `npm run test:e2e:sanity` | `cd src/Frontend && npm run test:e2e:sanity` | ✓ WIRED | ci.yml line 404 |
| `ci.yml` (release) | `release-package/CHANGELOG.md` | `awk` excerpt extraction in release body step | ✓ WIRED | ci.yml release job CHANGELOG extraction step |
| `ci.yml` (release) | `gh release create` with zip asset | `actions/download-artifact` + `gh release create "$VERSION" ... "$ZIP_FILE"` | ✓ WIRED | ci.yml lines 466–480; `permissions: contents: write`, `GH_TOKEN` set |
| `playwright.config.ts` (sanity project) | `tests/e2e/sanity.spec.ts` | `testMatch: ['**/sanity.spec.ts']` | ✓ WIRED | playwright.config.ts line 142 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REL-01 | 21-04 | Tagged GitHub release v0.2.0 with CHANGELOG | ✓ SATISFIED | `release` job in ci.yml creates GitHub release on v* tags with CHANGELOG excerpt; CHANGELOG.md has [v0.2.0] entry |
| REL-02 | 21-04 | Offline Helm package for air-gapped OCP deployment | ✓ SATISFIED | `release-package/README.md` has full offline/air-gapped deployment section; assemble-package.sh produces self-contained folder with all tars + Helm chart |
| REL-03 | 21-01 | CI produces versioned, timestamped deployment folder uploaded as artifact | ✓ SATISFIED | `deployment-${VERSION}-${TIMESTAMP}` folder structure in assemble-package.sh; uploaded with retention-days: 90 |
| REL-04 | 21-01 | CI builds all app images from source on every run | ✓ SATISFIED | `docker-build` job calls `build-all-images.sh` which builds all 10 images via `docker build --file` |
| REL-05 | 21-03 | CI runs `helm upgrade --install` with values-local.yaml after image load | ✓ SATISFIED | `sanity-deploy` job runs exact Helm command with `--namespace ez-platform --create-namespace --values helm/ez-platform/values-local.yaml --wait --timeout 15m` |
| REL-06 | 21-02, 21-03 | CI seeds with DemoDataGenerator then runs @Sanity suite; fails if any test fails | ✓ SATISFIED | `sanity-deploy` job: seeds via `dotnet run --project tools/DemoDataGenerator -- --direct-connection --api-url http://localhost:5001`, then `npm run test:e2e:sanity` (no continue-on-error) |

All 6 requirements satisfied. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/assemble-package.sh` | 73–74 | `GITHUB_OUTPUT:-/dev/null` fallback suppresses output write silently during CI | ℹ️ Info | If `GITHUB_OUTPUT` is unset in CI (unusual), the `PKG_NAME` step output will not propagate. This is unlikely in real GitHub Actions but could silently break `package-release` job output wiring. Acceptable tradeoff for local-run compatibility. |
| `.github/workflows/ci.yml` | 271–274 | `ls -lh "${PKG_NAME}.zip"` path — `cd dist` then `ls -lh` without `dist/` prefix | ℹ️ Info | Minor: after `cd dist`, the `ls` line uses `dist/${PKG_NAME}.zip` which would be `dist/dist/...` — however the upload path `dist/${{ steps.assemble.outputs.PKG_NAME }}.zip` is evaluated from the workspace root, which is correct for the upload-artifact step. Cosmetic inconsistency only. |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments in core implementation files.

---

## Human Verification Required

### 1. CI Pipeline Execution (Full Run)

**Test:** Push to `main` branch or create a `v0.2.0` tag; observe GitHub Actions run
**Expected:** `docker-build` builds 10 images (~35 min), `package-release` assembles zip artifact, `release` creates GitHub release with CHANGELOG body and zip attached
**Why human:** Cannot execute GitHub Actions runners or validate artifact upload behavior programmatically from local codebase inspection

### 2. Sanity-Deploy Job on Self-Hosted Runner

**Test:** With `vars.EZ_K8S_RUNNER` set to `'true'` in repo variables and self-hosted runner online, push to main
**Expected:** All 7 @Sanity tests pass within 5 minutes; CI step summary shows pod states; test results artifact uploaded
**Why human:** Requires live Minikube cluster, port-forwards, and DemoDataGenerator seeding to validate end-to-end behavior

### 3. Frontend Title Assertion (SANITY-07)

**Test:** Run `npm run test:e2e:sanity` against live cluster; verify SANITY-07 passes
**Expected:** `page.title()` returns a string containing "EZ" — depends on actual `<title>` tag in the React app
**Why human:** Cannot verify the exact `<title>` content of the built frontend without running it. If the title is "EZ Platform" this passes; if it differs, the assertion fails.

---

## Gaps Summary

No gaps found. All phase goal components are fully implemented and wired:

- Three build/assembly scripts exist with correct structure, error propagation (`set -euo pipefail`), and all required service/image entries
- CI pipeline has 4 new jobs in correct dependency chain: `docker-build` → `package-release` → `sanity-deploy` (gated) and `release` (tag-gated)
- 7 @Sanity Playwright tests are API-level, isolated to `sanity.spec.ts`, and correctly wired to the `sanity` Playwright project
- CHANGELOG v0.2.0 entry documents all milestone features; README has full offline deployment guide
- All 6 requirements (REL-01 through REL-06) are fully satisfied

---

_Verified: 2026-03-18_
_Verifier: Claude (gsd-verifier)_
