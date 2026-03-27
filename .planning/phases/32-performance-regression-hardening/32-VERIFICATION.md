---
phase: 32-performance-regression-hardening
verified: 2026-03-27T18:00:00Z
status: gaps_found
score: 9/12 must-haves verified
re_verification: false
gaps:
  - truth: "All NAS devices seeded by DemoDataGenerator reach Provisioned status via the frontend Provision button (no API calls)"
    status: failed
    reason: "Chrome MCP browser automation was unavailable; API calls (POST /api/v1/nasdevices/{id}/provision) were used directly instead of the frontend Provision button. D-11, D-12 explicitly forbid API as a substitute. NAS provisioning via frontend UI was never demonstrated."
    artifacts:
      - path: ".planning/phases/32-performance-regression-hardening/32-02-SUMMARY.md"
        issue: "Summary documents 'Used API calls instead of Chrome browser automation' as a deviation and notes 'Frontend UI interaction not validated in this run'"
    missing:
      - "Re-run NAS provisioning using actual frontend UI (Admin → NAS Devices → Provision button) — Chrome MCP tools or Playwright headed test"
  - truth: "A new datasource is created entirely from the frontend form and appears in the datasource list"
    status: failed
    reason: "Datasource create was performed via API POST, not the frontend form. D-14 requires frontend-only CRUD. D-17 requires UI verification, not API."
    artifacts:
      - path: ".planning/phases/32-performance-regression-hardening/32-02-SUMMARY.md"
        issue: "Summary states 'Chrome browser automation tools (mcp__claude-in-chrome__*) were not available … API calls were used as a pragmatic fallback'"
    missing:
      - "Re-run datasource create through the frontend form (http://localhost:7000/datasources/new) and verify in UI"
  - truth: "Full pipeline test: a datasource with output destination completes processing and records appear in output"
    status: failed
    reason: "Pipeline test was approved on infrastructure evidence (28 RabbitMQ messages acked) not on a completed file-processing cycle. FTP passive mode is blocked by NodePort and NFS connector requires pod-mount-path config. No file was actually read, processed, validated, and routed to an output destination."
    artifacts:
      - path: ".planning/phases/32-performance-regression-hardening/32-03-SUMMARY.md"
        issue: "Summary states 'Full end-to-end file processing was blocked by two infrastructure issues' and 'approved based on RabbitMQ 28-message ack evidence'"
    missing:
      - "Identify a working input connection (e.g. correctly-configured NAS with pod-mount FilePath) and trigger a full file cycle through to output"
      - "Verify business_records_processed_total metric increments or output folder contains processed file"
human_verification:
  - test: "Frontend NAS provisioning"
    expected: "Each NAS device row in Admin → NAS Devices shows Provisioned status after clicking the Provision button (no API call)"
    why_human: "Chrome MCP tools were unavailable during plan execution; requires interactive browser session"
  - test: "Frontend datasource create, import-from-file, and clone flows"
    expected: "Form submits successfully, new record appears in list, import auto-generates schema in Monaco editor, clone shows Hebrew prefix"
    why_human: "Chrome MCP tools were unavailable; requires interactive browser session to verify RTL form interactions"
  - test: "Full pipeline file-processing cycle"
    expected: "File discovered → validated → output written; monitoring page shows completed job; records_processed counter increments"
    why_human: "Requires working input connection (NFS with correct pod-mount path) and observation of end-to-end execution"
---

# Phase 32: Clean Install & End-to-End Acceptance Test — Verification Report

**Phase Goal:** Deploy v0.5.0 from the offline deployment package onto a completely clean cluster simulating a new OCP environment, then run end-to-end acceptance tests: NAS provisioning (frontend only), datasource CRUD (frontend only), full pipeline cycle, no-output edge case, and Help button → Docusaurus v0.5.0 navigation.

**Verified:** 2026-03-27
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All PVs cleaned and ez-platform namespace deleted before install | ✓ VERIFIED | 32-01-SUMMARY: Task 1 complete, full wipe including RBAC; 22 pods Running confirmed |
| 2 | All 21 Docker images loaded from offline package before install | ✓ VERIFIED | 32-01-SUMMARY: 21 images loaded (10 service + 11 infra) |
| 3 | install.ps1 --local completes and all pods reach Running | ✓ VERIFIED | 32-01-SUMMARY: 22 pods Running; 20/20 Playwright sanity tests passed in 1.7 min |
| 4 | All 18+ port-forwards active; frontend responds HTTP 200 at localhost:7000 | ✓ VERIFIED | 32-01-SUMMARY: curl 200 at localhost:7000 and localhost:5001/health |
| 5 | DemoDataGenerator seeds NAS devices (IsProvisioned=false) and datasources | ✓ VERIFIED | 32-01-SUMMARY: 6 NAS devices, 20 datasources, 20 schemas seeded |
| 6 | NAS devices reach Provisioned status via frontend Provision button only | ✗ FAILED | 32-02-SUMMARY: API used directly (mcp__claude-in-chrome tools unavailable). D-11/D-12 violated. |
| 7 | New datasource created from frontend form and visible in list | ✗ FAILED | 32-02-SUMMARY: Datasource created via API POST, not frontend form. D-14/D-17 violated. |
| 8 | Import from File: CSV uploads, schema auto-generated in Monaco Editor, datasource saves | ? UNCERTAIN | 32-02-SUMMARY: Created via API with JSON schema inline; no actual CSV file upload or Monaco Editor interaction observed |
| 9 | Clone from list and details page: Hebrew prefix, confirm/cancel flow works | ? UNCERTAIN | 32-02-SUMMARY: Clone created via API; Hebrew prefix mangled by curl encoding; no UI modal or form interaction verified |
| 10 | Full pipeline cycle completes with records routed to output | ✗ FAILED | 32-03-SUMMARY: Approved on RabbitMQ ack evidence only; FTP blocked by NodePort, NFS needs pod-mount FilePath; no file actually processed end-to-end |
| 11 | No-output pipeline: job completes without error | ? UNCERTAIN | 32-03-SUMMARY: Approved on code review (OutputService returns at line 109-115 when no destinations); no actual pipeline run executed |
| 12 | Help button → Docusaurus v0.5.0 at NodePort 30800 | ✓ VERIFIED | 32-03-SUMMARY: HTTP 200, v0.5.0 content, Hebrew, not static HTML. getDocsBaseUrl() verified in code. |

**Score:** 6/12 truths fully verified (3 additional uncertain requiring human confirmation)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `dist/deployment-v0.5.0-20260327-000831/install.ps1` | Install script for offline deployment | ✓ VERIFIED | File exists; executed successfully; 22 pods Running |
| `dist/deployment-v0.5.0-20260327-000831/images/services/` | 10 service .tar images | ✓ VERIFIED | 10 files present |
| `dist/deployment-v0.5.0-20260327-000831/images/infrastructure/` | 11 infrastructure .tar images | ✓ VERIFIED | 11 files present |
| `src/Frontend/src/utils/docs-url.ts` | getDocsBaseUrl() auto-detection | ✓ VERIFIED | Substantive: 99 lines, isPrivateNetwork(), isDevelopment(), getDocsBaseUrl() returning `http://${hostname}:30800` on private network. Exported and used. |
| `src/Frontend/src/pages/help/HelpPage.tsx` | Redirects to {docsBaseUrl}/docs/user-guide/ | ✓ VERIFIED | Substantive: useEffect redirects to `${getDocsBaseUrl()}/docs/user-guide/`. Correctly imported and wired. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| AppHeader Help button | http://{hostname}:30800/docs/user-guide/ | openDocsInNewTab('docs/user-guide/') | ✓ WIRED | AppHeader.tsx line 108: `onClick={() => openDocsInNewTab('docs/user-guide/')}`. Imports openDocsInNewTab from docs-url.ts. |
| HelpPage.tsx | http://{hostname}:30800/docs/user-guide/ | getDocsBaseUrl() + redirect | ✓ WIRED | useEffect calls `window.location.href = ${getDocsBaseUrl()}/docs/user-guide/` |
| Frontend Admin NAS Devices tab | POST /api/v1/nasdevices/{id}/provision | Provision button click | ? UNVERIFIED | Backend API confirmed working (all 6 provisioned via API). Frontend button not tested via UI automation. |
| Import from File button | Monaco Editor schema field | Client-side CSV analysis | ? UNVERIFIED | File not uploaded via UI; schema was injected via API payload. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `docs-url.ts: getDocsBaseUrl()` | window.location.hostname | Browser runtime | Yes — uses actual hostname | ✓ FLOWING |
| `HelpPage.tsx` | docsUrl string | getDocsBaseUrl() + literal path | Yes — constructs URL dynamically | ✓ FLOWING |
| `OutputService: ValidationCompletedEventConsumer.cs` | dataSource.Output.Destinations | MongoDB via DB.Find<DataProcessingDataSource> | Yes — real DB query at line 90 | ✓ FLOWING |
| OutputService no-output branch | None | Destinations.Any() check at line 109 | Logs warning and returns — does NOT throw | ✓ FLOWING (code-level) |

---

### Behavioral Spot-Checks

| Behavior | Evidence | Status |
|----------|----------|--------|
| install.ps1 produces running cluster | 20/20 Playwright sanity tests passed in 1.7 min; 22 pods Running | ✓ PASS |
| Docusaurus NodePort 30800 serves v0.5.0 content | 32-03-SUMMARY: HTTP 200, Hebrew user guide content, not static HTML | ✓ PASS |
| getDocsBaseUrl() constructs correct URL | Code verified: `http://${window.location.hostname}:30800` on private/localhost | ✓ PASS |
| OutputService handles no-output gracefully | Code: lines 109-115 log warning and return without throwing | ✓ PASS (code-level) |
| NAS provisioning API works | 6/6 devices provisioned (all static NFS) | ✓ PASS (API path) |
| Pipeline messaging operational | RabbitMQ 28 msgs acked across all service queues | ✓ PASS |
| Frontend datasource create via API | 23 datasources in DB (20 seeded + 3 acceptance) | ✓ PASS (API path) |
| Hazelcast dedup fix applied | Git commit ca78391: dedup hash write moved after successful publish | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| D-01 | 32-01 | Full namespace wipe before deploy | ✓ SATISFIED | 32-01 Task 1: namespace deleted, PVs cleaned, RBAC deleted |
| D-02 | 32-01 | Unmount and delete ALL PVs before wipe | ✓ SATISFIED | 32-01 Task 1: stale Released/Retained PVs deleted |
| D-03 | 32-01 | Simulate clean OCP environment — no shortcuts | ✓ SATISFIED | Full wipe from scratch confirmed |
| D-04 | 32-01 | Use install.ps1 from deployment package | ✓ SATISFIED | 32-01 Task 3/6: install.ps1 --local executed |
| D-05 | 32-01 | Do NOT use scripts/clean-deploy.sh | ✓ SATISFIED | No evidence of clean-deploy.sh usage |
| D-06 | 32-01 | Run install.ps1 --local | ✓ SATISFIED | --local flag used; single-replica values applied |
| D-07 | 32-01 | Images loaded from deployment package before install | ✓ SATISFIED | 21 .tar images loaded via minikube image load |
| D-08 | 32-01 | DemoDataGenerator: --use-simulator --create-servers --direct-connection | ✓ SATISFIED | 32-01 Task 5: correct flags documented |
| D-09 | 32-01 | NAS device records created in DB (not provisioned) | ✓ SATISFIED | 6 NAS devices with IsProvisioned=false initially |
| D-10 | 32-01 | No --provision-nas in DemoDataGenerator for initial seed | ✓ SATISFIED | Initial seed had no --provision-nas; later Plan 32-01 Task 6 added it for SANITY-11 |
| D-11 | 32-02 | Provision all NAS devices from frontend Provision button only | ✗ BLOCKED | API used directly; frontend button not exercised |
| D-12 | 32-02 | No API calls for NAS provisioning | ✗ BLOCKED | API used as fallback; explicitly prohibited by this requirement |
| D-13 | 32-02 | Each NAS device reaches Provisioned state in UI | ? NEEDS HUMAN | All 6 provisioned via API (IsProvisioned=true in DB); UI not verified |
| D-14 | 32-02 | All datasource operations from frontend only | ✗ BLOCKED | Datasource create/import/clone used API, not frontend |
| D-15 | 32-02 | Create from file: upload CSV, verify schema auto-generation in UI | ✗ BLOCKED | No CSV upload via UI; schema injected via API payload |
| D-16 | 32-02 | Clone from list page AND details page | ✗ BLOCKED | Clone via API only; neither list nor details page UI tested |
| D-17 | 32-02 | No API shortcuts — verify in UI | ✗ BLOCKED | API used exclusively for verification in Plan 32-02 |
| D-18 | 32-03 | Full pipeline test: create datasource → trigger → verify output | ? PARTIAL | Infrastructure blocked (FTP NodePort, NFS path); approved on RabbitMQ evidence; no actual file cycle completed |
| D-19 | 32-03 | No-output pipeline test: job completes without error | ? PARTIAL | Approved on code review; code confirmed to handle gracefully; no actual run observed |
| D-25 | 32-03 | Help button redirects to Docusaurus user guide | ✓ SATISFIED | getDocsBaseUrl() + openDocsInNewTab verified in code and runtime |
| D-26 | 32-03 | Docusaurus serves v0.5.0 content | ✓ SATISFIED | HTTP 200, Hebrew v0.5.0 content confirmed |
| D-27 | 32-03 | Port auto-detection without manual config | ✓ SATISFIED | getDocsBaseUrl() uses window.location.hostname dynamically |
| D-28 | 32-03 | Help click → Docusaurus at NodePort 30800 | ✓ SATISFIED | AppHeader.tsx wired to openDocsInNewTab('docs/user-guide/') |

**Requirements with no plan claim (orphaned from D-20 through D-24):**
- D-20 (test method: Playwright or Chrome extension), D-21–D-24 (test helper patterns) were defined in CONTEXT.md but not claimed in any plan's `requirements:` field. These are test methodology decisions, not acceptance gates, and are implicitly covered by the execution approach.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `OutputService/Consumers/ValidationCompletedEventConsumer.cs` line 221 | `// TODO: Publish OutputCompletedEvent for monitoring` | ℹ️ Info | Monitoring gap but does not block pipeline function |
| Plan 32-02 execution | API used as direct substitute for frontend UI flows (D-11, D-12, D-14, D-17) | 🛑 Blocker | Core acceptance gate (frontend-only CRUD) never exercised; goal not achieved for CRUD requirements |

---

### Human Verification Required

#### 1. NAS Provisioning via Frontend UI

**Test:** Navigate to http://localhost:7000/admin/nas-devices (or Admin menu → NAS Devices). For each device showing "Not Provisioned", click the Provision button. Wait for status to change to "Provisioned".

**Expected:** All NAS devices show Provisioned status in the UI. The frontend calls POST /api/v1/nasdevices/{id}/provision internally — this is the allowed path. No direct API call from the tester.

**Why human:** Chrome MCP tools were unavailable during plan execution. Requires interactive browser session.

#### 2. Datasource Create Flow via Frontend Form

**Test:** Navigate to http://localhost:7000/datasources/new. Fill in Name, Supplier, Category. Navigate to Connection tab and fill connection details. Click Save. Verify new record appears in the datasource list.

**Expected:** Form submits with success toast. New datasource appears in list.

**Why human:** Chrome MCP tools unavailable. RTL Ant Design form navigation requires interactive browser.

#### 3. Import from File (CSV → Schema auto-generation)

**Test:** On the datasource create form, click "Import from File" (or Hebrew equivalent). Upload a CSV file with named columns. Verify the ImportWizard modal shows a parsed preview and the schema is auto-generated in Monaco Editor with correct field types. Apply to form and save.

**Expected:** Schema fields appear in Monaco Editor matching CSV column names and inferred types (integer, string, number, boolean).

**Why human:** File upload interaction and Monaco Editor content verification require interactive browser.

#### 4. Clone from List and Details Page

**Test:** On datasource list, use the clone/copy action on any row. Verify modal appears with Hebrew confirmation. Confirm — form opens with "העתק של" prefix in name field. On a datasource details page, click Clone button. Verify same prefix and flow. Cancel (do not save duplicate).

**Expected:** Hebrew prefix "העתק של" visible in form; both clone entry points work; cancel does not create a record.

**Why human:** Requires interactive browser for modal and form interaction.

#### 5. Full Pipeline File Processing Cycle

**Test:** Identify a datasource with a working NAS input connection (FilePath set to the pod-mount path, e.g., /mnt/nfs-input-data) and an output destination. Trigger processing. Monitor via http://localhost:7000/monitoring or Prometheus business metrics (business_records_processed_total).

**Expected:** Job completes with status Completed. Output destination receives processed file. No error in monitoring.

**Why human:** Requires configuring a working NAS datasource (pod-mount FilePath) and observing pipeline execution in real time. FTP is blocked by NodePort passive-mode limitation.

#### 6. No-Output Pipeline Test

**Test:** Create or identify a datasource with valid input connection but zero output destinations. Trigger processing. Observe job in monitoring — status must be Completed (not Failed or Error). Check OutputService logs: should log "No output destinations configured" warning and return, not throw.

**Expected:** Job completes successfully with no error status, no error toast, no exception in logs.

**Why human:** Requires running the pipeline with a specially configured datasource and observing real-time behavior.

---

### Gaps Summary

The phase split into three plans executed correctly for infrastructure concerns (Plans 32-01 and partial 32-03), but the core frontend acceptance gate (Plan 32-02) was bypassed.

**Root cause:** Chrome MCP browser automation tools (`mcp__claude-in-chrome__*`) were not available to the executor agent. The plan explicitly prohibited API calls as a substitute for frontend-only flows (D-11, D-12, D-14, D-17). Despite this, API calls were used as a "pragmatic fallback."

**What this means for goal achievement:** The phase goal states acceptance tests must include "NAS provisioning (frontend only)" and "datasource CRUD (frontend only)". These were not performed via the frontend. The underlying backend APIs work correctly — NAS provisioning succeeds, datasource creation works, the clone API stores records. However, the UI flows (form rendering, schema auto-generation in Monaco Editor, clone modal with Hebrew prefix, Provision button) were not exercised.

**Items that ARE confirmed:**
- Clean install from offline package is validated (20/20 Playwright sanity tests)
- Docusaurus v0.5.0 at NodePort 30800 works correctly (code + HTTP verification)
- getDocsBaseUrl() auto-detection is correct (code verified)
- No-output graceful handling is confirmed in OutputService code (lines 109-115)
- Hazelcast dedup bug was found and fixed (commit ca78391, filediscovery:v0.5.0-dedup-fix)
- Pipeline messaging infrastructure is operational (RabbitMQ 28 msgs acked, all services connected)

**Items requiring follow-up (gaps):**
1. NAS provisioning via frontend Provision button (D-11, D-12, D-13)
2. Datasource create/import/clone via frontend form (D-14, D-15, D-16, D-17)
3. Full file-processing pipeline cycle from input to output (D-18)
4. No-output pipeline observed in a real run (D-19, though code is correct)

The three UNCERTAIN truths (items 8, 9, 11) may upgrade to VERIFIED after human verification but cannot be confirmed programmatically.

---

_Verified: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
