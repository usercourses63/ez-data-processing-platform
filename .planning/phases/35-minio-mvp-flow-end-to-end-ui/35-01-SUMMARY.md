---
phase: 35-minio-mvp-flow-end-to-end-ui
plan: 01
subsystem: frontend-admin
tags: [s3, minio, server-form, validation, i18n, bugs-must-fix]
requires:
  - Phase 34-03 ServerModal S3 branch (TypeSpecificConfig packing)
provides:
  - S3 console-port (30901) submit guard on ServerModal with API-port (30900) guidance
  - Bugs-must-fix register established as the Phase-35 iterate backlog
affects:
  - src/Frontend/src/pages/admin/components/ServerModal.tsx
  - src/Frontend/src/i18n/locales/he.json
  - src/Frontend/src/i18n/locales/en.json
tech-stack:
  added: []
  patterns:
    - Ant Design Form.Item async validator rule scoped to a server type (S3-only)
    - i18n via t(key) || '<fallback>' (Hebrew primary, English fallback)
key-files:
  created:
    - src/Frontend/src/pages/admin/components/__tests__/ServerModal.s3port.test.tsx
  modified:
    - .planning/phases/35-minio-mvp-flow-end-to-end-ui/BUGS-MUST-FIX.md
    - src/Frontend/src/pages/admin/components/ServerModal.tsx
    - src/Frontend/src/i18n/locales/he.json
    - src/Frontend/src/i18n/locales/en.json
decisions:
  - "Translation files live at src/Frontend/src/i18n/locales/{he,en}.json, NOT the plan's src/locales/{he,en}/translation.json path — used the real files (deviation, Rule 3)."
  - "Test placed in components/__tests__/ to match plan's files_modified path; relative imports adjusted one level deeper than the sibling ServerModal.test.tsx in components/."
  - "Guard rejects the literal console port 30901 only (no range) to avoid false positives, per plan."
metrics:
  duration: ~12m
  completed: 2026-06-08
  tasks: 2
  files_changed: 5
---

# Phase 35 Plan 01: MinIO Console-Port Guard + Bugs-Must-Fix Register Summary

S3 server form now blocks the MinIO **console port 30901** at submit-time with a clear message steering the admin to the **S3 API port 30900**, and the phase bugs-must-fix register (G1-G6 + closure gate) is finalized as the iterate backlog — closing bug **G4** (FIX-IN-CODE; live re-verify in 35-03) and anchoring SC-1.

## What Was Built

### Task 1 — Bugs-must-fix register finalized (SC-1)
- Confirmed `BUGS-MUST-FIX.md` rows G1-G6 match the 35-CONTEXT G1-G6 table (IDs, status, severity): G4 `OPEN`/`MAJOR`, G5 `OPEN`/`BLOCKER`; closure gate references SC-7 and SC-8.
- Added an executor note under the "Newly discovered bugs" table instructing executors to append rows (with a closing plan) whenever mapping forms or running the flow surfaces a new gap.
- Commit: `179948e`.

### Task 2 — MinIO console-port (30901) guard on ServerModal (G4, TDD)
- **RED** (`aaa88d4`): added `ServerModal.s3port.test.tsx` with three behavior cases — S3+30901 blocks submit and names port 30900; S3+30900 allows submit; ftp+30901 is not blocked (S3-only). One case failed as expected (no guard yet); the other two passed.
- **GREEN** (`e449b77`):
  - Added an S3-only `validator` rule on the `Port` `Form.Item` that rejects `30901` with a message naming the API port 30900. The rule is inert for non-S3 server types (`isS3` guard) and is the literal console port only (no range) to avoid false positives.
  - Added an inline `Typography.Text type="secondary"` hint under the S3/MinIO divider: "MinIO: use the S3 API port (e.g. 30900). The console port (30901) is not an S3 endpoint."
  - Added i18n keys `admin.servers.s3.consolePortError` and `admin.servers.s3.apiPortHint` to both `he.json` (primary) and `en.json` (fallback), referenced via `t(...) || '<fallback>'`.
  - Did NOT touch the request mapping or the PascalCase `TypeSpecificConfig` contract (34-01) — form validation + guidance only. Port `InputNumber` keeps `className="ltr-field"`.
  - Marked G4 `FIX-IN-CODE` in the register; live Test-Connection re-verify deferred to 35-03.

## Verification

- `npx vitest run src/pages/admin/components/__tests__/ServerModal.s3port.test.tsx` → **3/3 passing**.
- `npx vitest run src/pages/admin/components/ServerModal.test.tsx` (existing 34-05 suite) → **4/4 passing** (no regression).
- `npx tsc --noEmit` → no errors for the touched ServerModal files.
- Register completeness check (G4, G5, BLOCKER, SC-7 all present) → OK.

Live verification (UI Test Connection against file-simulator MinIO at `:30900`) is intentionally deferred to plan **35-03**, which runs against the cluster.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Translation files at a different path than the plan stated**
- **Found during:** Task 2.
- **Issue:** The plan referenced `src/Frontend/src/locales/he/translation.json` and `.../en/translation.json`, which do not exist.
- **Fix:** Located the real i18n files at `src/Frontend/src/i18n/locales/he.json` and `en.json` (the `admin.servers` namespace) and added the keys there.
- **Files modified:** `src/Frontend/src/i18n/locales/he.json`, `src/Frontend/src/i18n/locales/en.json`.
- **Commit:** `e449b77`.

**2. [Rule 3 - Blocking] Test directory path normalized to `__tests__/`**
- **Found during:** Task 2.
- **Issue:** The plan's verify command and `files_modified` point to `components/__tests__/ServerModal.s3port.test.tsx`, but the sibling `ServerModal.test.tsx` lives directly in `components/`. The Vitest glob (`src/**/*.{test,spec}.{ts,tsx}`) matches both.
- **Fix:** Placed the new test in `components/__tests__/` (matching the plan's stated path) and adjusted the relative imports one level deeper (`../ServerModal`, `../../../../services/...`).
- **Commit:** `aaa88d4`.

## TDD Gate Compliance

- RED gate: `test(35-01): ...` commit `aaa88d4` (failing guard test committed before implementation).
- GREEN gate: `feat(35-01): ...` commit `e449b77` (implementation makes the test pass).
- REFACTOR: none needed.

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: src/Frontend/src/pages/admin/components/__tests__/ServerModal.s3port.test.tsx
- FOUND: src/Frontend/src/pages/admin/components/ServerModal.tsx (Port validator + apiPortHint)
- FOUND: src/Frontend/src/i18n/locales/he.json (admin.servers.s3.*)
- FOUND: src/Frontend/src/i18n/locales/en.json (admin.servers.s3.*)
- FOUND commit: 179948e (register), aaa88d4 (RED test), e449b77 (GREEN impl)
