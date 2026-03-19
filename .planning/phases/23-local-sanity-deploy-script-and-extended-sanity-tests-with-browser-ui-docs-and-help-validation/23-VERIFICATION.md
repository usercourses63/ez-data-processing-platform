---
phase: 23-local-sanity-deploy-script-and-extended-sanity-tests-with-browser-ui-docs-and-help-validation
verified: 2026-03-19T10:45:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 23: Local Sanity Deploy Script + Extended Sanity Tests Verification Report

**Phase Goal:** Create a single local sanity deploy script (bash + PowerShell) that performs a full clean deploy from dist/ artifacts, plus extend the @Sanity Playwright suite to 10 tests including docs/help page validation, with headed browser mode and double-run consistency check.
**Verified:** 2026-03-19T10:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SANITY-08 test navigates to docs homepage at localhost:30800 and asserts HTTP 200 and page contains EZ or documentation | VERIFIED | `sanity.spec.ts` line 128-133: `page.goto(DOCS_URL + '/docs/')`, status 200, `/ez\|documentation/i` regex |
| 2 | SANITY-09 test navigates to Hebrew user guide and asserts Hebrew characters present | VERIFIED | `sanity.spec.ts` line 136-141: `page.goto(DOCS_URL + '/docs/user-guide-he')`, status 200, `/[\u05D0-\u05EA]/` regex |
| 3 | SANITY-10 test clicks Help button, catches popup via waitForEvent, asserts URL contains :30800 | VERIFIED | `sanity.spec.ts` line 144-154: `Promise.all([page.waitForEvent('popup'), helpButton.click()])`, `popup.url()` contains `:30800` |
| 4 | npm run test:e2e:sanity:headed opens a visible browser window for the sanity project | VERIFIED | `package.json` line 49: `"test:e2e:sanity:headed": "playwright test --project=sanity --headed"` |
| 5 | Running bash scripts/sanity-test.sh performs a full clean deploy cycle from dist/ and runs sanity tests twice | VERIFIED | `scripts/sanity-test.sh` 183 lines: namespace delete → image cache purge → parallel image load → Helm → pod wait → port-forwards → seed → double test run |
| 6 | Running powershell scripts/sanity-test.ps1 performs the same cycle on Windows | VERIFIED | `scripts/sanity-test.ps1` 218 lines: mirrors bash script with PowerShell idioms, Start-Job parallelism |
| 7 | Port-forward for docs service (svc/docs 30800:80) is included in both sanity scripts and start-port-forwards.ps1 | VERIFIED | `sanity-test.sh` line 139, `sanity-test.ps1` line 156, `start-port-forwards.ps1` line 39 (`@{Name="Docs Portal"; Port=30800; Service="docs"; TargetPort=80}`) |
| 8 | Script exits 0 only if both sanity runs pass | VERIFIED | `sanity-test.sh` line 182: `exit $(( RUN1_EXIT + RUN2_EXIT > 0 ? 1 : 0 ))`. `sanity-test.ps1` lines 213-216: explicit exit 0 / exit 1 based on both run results |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/Frontend/tests/e2e/sanity.spec.ts` | 10 sanity tests (7 existing + 3 new docs/help tests) | VERIFIED | 155 lines, SANITY-01 through SANITY-10, all substantive implementations. Committed in `f7971ab`. |
| `src/Frontend/package.json` | test:e2e:sanity:headed npm script | VERIFIED | Line 49: `"test:e2e:sanity:headed": "playwright test --project=sanity --headed"`. Valid JSON confirmed. Committed in `5f13be3`. |
| `scripts/sanity-test.sh` | Bash local sanity deploy and test script | VERIFIED | 183 lines, executable bit set, bash syntax valid (`bash -n` exits 0). Committed in `ddfa0e5`. |
| `scripts/sanity-test.ps1` | PowerShell local sanity deploy and test script | VERIFIED | 218 lines, mirrors bash logic with PowerShell idioms. Committed in `b4b33a3`. |
| `scripts/start-port-forwards.ps1` | Updated port-forward script with docs service | VERIFIED | Lines 39 and 73 contain Docs Portal entry on port 30800. Committed in `b4b33a3`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `sanity.spec.ts` | `localhost:30800` | DOCS_URL constant | WIRED | Line 19: `const DOCS_URL = process.env.DOCS_URL \|\| 'http://localhost:30800'`; used in SANITY-08 and SANITY-09 |
| `sanity.spec.ts` | `page.waitForEvent` | popup event for Help button new tab | WIRED | Line 149: `page.waitForEvent('popup')` in SANITY-10 |
| `scripts/sanity-test.sh` | `helm/ez-platform/values-local.yaml` | Helm deploy values reference | WIRED | Line 105: `--values "$REPO_ROOT/helm/ez-platform/values-local.yaml"` |
| `scripts/sanity-test.sh` | `src/Frontend` | npm run test:e2e:sanity:headed execution | WIRED | Lines 153, 161, 165: `cd "$REPO_ROOT/src/Frontend"` then `npm run test:e2e:sanity:headed` twice |
| `scripts/sanity-test.sh` | `tools/DemoDataGenerator` | dotnet run for data seeding | WIRED | Line 147: `dotnet run --project "$REPO_ROOT/tools/DemoDataGenerator" -- --direct-connection --api-url http://localhost:5001` |
| `scripts/sanity-test.ps1` | `helm/ez-platform/values-local.yaml` | Helm deploy values reference | WIRED | Line 124: `--values "$RepoRoot\helm\ez-platform\values-local.yaml"` |
| `scripts/sanity-test.ps1` | `src/Frontend` | npm run test:e2e:sanity:headed execution | WIRED | Lines 177, 185, 190: `Set-Location "$RepoRoot\src\Frontend"` then double test run |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SANITY-08 | 23-01 | Docs homepage opens and contains expected content | SATISFIED | `sanity.spec.ts` lines 128-133 |
| SANITY-09 | 23-01 | Hebrew user guide loads with Hebrew content | SATISFIED | `sanity.spec.ts` lines 136-141 |
| SANITY-10 | 23-01 | Frontend Help button navigates to docs via popup | SATISFIED | `sanity.spec.ts` lines 144-154 |
| SANITY-HEADED | 23-01 | npm run test:e2e:sanity:headed opens visible browser | SATISFIED | `package.json` line 49 |
| SANITY-SCRIPT-BASH | 23-02 | Bash local sanity deploy and test script | SATISFIED | `scripts/sanity-test.sh` — full 13-step deploy cycle |
| SANITY-SCRIPT-PS1 | 23-02 | PowerShell local sanity deploy and test script | SATISFIED | `scripts/sanity-test.ps1` — mirrors bash for Windows |
| SANITY-PORTFWD-DOCS | 23-02 | Docs service port-forward on port 30800 in scripts | SATISFIED | Both sanity scripts + `start-port-forwards.ps1` updated |
| SANITY-CONSISTENCY | 23-02 | Double-run consistency check | SATISFIED | Both scripts: RUN1_EXIT + RUN2_EXIT tracking, exit 1 if either fails |

**No orphaned requirements detected.** All 8 requirement IDs declared in plan frontmatter are covered and verified.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

No anti-patterns, stubs, TODOs, or placeholder implementations found across any modified files.

---

### Human Verification Required

#### 1. SANITY-10 popup capture requires running frontend + docs

**Test:** Run `npm run test:e2e:sanity:headed` against a live cluster. Click the Help button in the frontend header. Observe that a new browser tab opens navigating to `localhost:30800`.
**Expected:** New tab opens, URL contains `:30800`, Playwright catches it via `waitForEvent('popup')` without timeout.
**Why human:** The `window.open()` + popup capture only works when the frontend JS actually executes in a real browser against a running docs service. The implementation is correct but runtime behavior requires a live cluster.

#### 2. SANITY-08/09 require live Docusaurus service

**Test:** Start docs port-forward (`kubectl port-forward svc/docs 30800:80 -n ez-platform`) and run `npm run test:e2e:sanity:headed`.
**Expected:** SANITY-08 navigates to `localhost:30800/docs/` and finds "EZ" or "documentation" text. SANITY-09 navigates to `localhost:30800/docs/user-guide-he` and finds Hebrew characters.
**Why human:** Requires a running Docusaurus service. The routes `/docs/` and `/docs/user-guide-he` must exist and return content.

#### 3. Bash script end-to-end execution on Linux/macOS

**Test:** On a machine with `minikube`, `helm`, `kubectl`, `dotnet`, and `npm` available, run `bash scripts/sanity-test.sh` with a valid `dist/deployment-*/` directory.
**Expected:** Full deploy cycle completes, sanity tests run twice in headed Chromium, script prints "OVERALL: PASSED", exits 0.
**Why human:** Full deploy cycle involves external tools (minikube, Helm) that cannot be validated without a live cluster.

---

### Gaps Summary

No gaps. All 8 must-haves verified at all three levels (exists, substantive, wired). All 5 committed artifacts are complete implementations with no stubs or placeholder code. All key links between components are properly wired.

---

## Phase Commit Verification

| Commit | Description | Files |
|--------|-------------|-------|
| `f7971ab` | feat(23-01): add SANITY-08, SANITY-09, SANITY-10 docs/help browser tests | `src/Frontend/tests/e2e/sanity.spec.ts` |
| `5f13be3` | feat(23-01): add test:e2e:sanity:headed npm script | `src/Frontend/package.json` |
| `ddfa0e5` | feat(23-02): create bash local sanity deploy and test script | `scripts/sanity-test.sh` |
| `b4b33a3` | feat(23-02): create PowerShell sanity script and add docs port-forward | `scripts/sanity-test.ps1`, `scripts/start-port-forwards.ps1` |

---

_Verified: 2026-03-19T10:45:00Z_
_Verifier: Claude (gsd-verifier)_
