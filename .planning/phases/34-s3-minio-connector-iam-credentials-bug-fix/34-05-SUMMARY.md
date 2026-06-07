---
phase: 34-s3-minio-connector-iam-credentials-bug-fix
plan: 05
subsystem: frontend-test-tier
tags: [s3, minio, credentials, frontend, testing, vitest, playwright, webapp-testing]
requires:
  - ServerModal S3 branch + PascalCase TypeSpecificConfig packing (34-03)
  - SecretKey masking / write-only sentinel "********" (34-02)
provides:
  - Vitest unit coverage of the ServerModal S3 branch (field render, submit packing, masked-on-edit, keep-existing secret)
  - Playwright E2E spec creating an S3 server then running Test Connection (gated-skip pre-live)
  - webapp-testing Python comprehensive suite for masked-credential edge cases (T1–T5)
  - matchMedia + ResizeObserver jsdom polyfills enabling antd component tests under Vitest
affects:
  - src/Frontend/src/pages/admin/components/ServerModal.test.tsx
  - src/Frontend/tests/e2e/s3-server.spec.ts
  - src/Frontend/tests/webapp-testing/s3_server_comprehensive_test.py
  - src/Frontend/src/test/setup.ts
tech-stack:
  added: []
  patterns:
    - Vitest + @testing-library/react component test driving an antd Modal/Form via #id selectors
    - vi.mock of the servers-api-client to spy createServer/updateServer mutation args and stub getServerTypes(s3)
    - jsdom matchMedia/ResizeObserver stubs in the shared test setup so antd responsive observers mount
    - Conditional-skip gating (servers API / MinIO reachability probe) keeping live-dependent specs green pre-live
    - webapp-testing skeleton (report() collector, sync_playwright headless, grouped banners, sys.exit on failure) reused from clone_comprehensive_test.py
key-files:
  created:
    - src/Frontend/src/pages/admin/components/ServerModal.test.tsx
    - src/Frontend/tests/e2e/s3-server.spec.ts
    - src/Frontend/tests/webapp-testing/s3_server_comprehensive_test.py
    - .planning/phases/34-s3-minio-connector-iam-credentials-bug-fix/34-05-SUMMARY.md
  modified:
    - src/Frontend/src/test/setup.ts
    - .planning/phases/34-s3-minio-connector-iam-credentials-bug-fix/deferred-items.md
decisions:
  - "Added matchMedia + ResizeObserver jsdom polyfills to the SHARED src/test/setup.ts (no per-test setup existed) so any antd component test can mount — Vitest threw 'window.matchMedia is not a function' from antd's responsive observer otherwise"
  - "Asserted ltr-field on the Secret Key via secretKey.closest('.ltr-field') because Input.Password applies the class on the affix-wrapper span, not the inner <input> (which carries .ant-input)"
  - "Implemented the Vitest submit/edit assertions at the API-mutation boundary (spying createServer/updateServer args) rather than asserting fetch payloads — robust to the component's internal mutation wiring"
  - "Gated all live-dependent assertions (E2E + webapp T1–T5) behind a servers-API reachability probe so the specs skip cleanly pre-live; authoritative live pass is 34-06"
metrics:
  duration: ~20m
  completed: 2026-06-07
---

# Phase 34 Plan 05: Frontend Test Tier (S3/MinIO ServerModal) Summary

Three complementary frontend test layers for the S3/MinIO credential UI added in 34-03: a **Vitest** unit suite that runs green here (no server needed), plus a **Playwright** E2E spec and a **webapp-testing** Python comprehensive suite that are authored and statically validated now and run live in 34-06. Together they satisfy SC-02 (UI fields render correctly) and SC-07 (E2E path), and the CLAUDE.md dual-tool mandate (`/gsd:add-tests` Vitest+Playwright AND the `webapp-testing` skill).

## What Was Built

**Vitest — `ServerModal.test.tsx` (4 specs, all passing):**
1. Type=s3 renders Access Key, a **masked** Secret Key (`input[type=password]`), Bucket, Region, and the path-style/http switches; technical inputs carry `ltr-field` (Secret Key's class lives on the affix wrapper), and Region defaults to `us-east-1`.
2. Submit packs `requestData.TypeSpecificConfig` with exactly `{ AccessKey, SecretKey, Bucket, Region, ForcePathStyle, UseHttp }` (PascalCase, no camelCase drift) and the switch defaults flow to `ForcePathStyle/UseHttp = true`.
3. Edit mode pre-fills the Secret Key with the masked sentinel `"********"` (never a real value) and flattens Access Key/Bucket/Region from `TypeSpecificConfig`.
4. Editing without touching the Secret Key posts the sentinel back verbatim → backend keep-existing logic retains the stored secret.

The suite mocks `servers-api-client` to spy `createServer`/`updateServer` args and stub `getServerTypes` with an s3 type.

**Playwright — `tests/e2e/s3-server.spec.ts` (2 tests, statically validated):**
- API-driven create of an S3 server with the PascalCase `TypeSpecificConfig`, then `POST /test-connection`, asserting `Success === true` and that the response never contains `"IAM credentials is missing"`; cleanup deletes the server in `finally`.
- A UI test that opens the admin create-server modal, selects type s3, and asserts the masked Secret Key + Access Key + Bucket fields render.
- Both reuse `antTabClick`/`extractId` conventions from `sanity.spec.ts` and **skip cleanly** when the servers API is unreachable.

**webapp-testing — `tests/webapp-testing/s3_server_comprehensive_test.py` (T1–T5, py_compile-clean):**
- **T1** Secret masking (DOM): `type=password` and the typed secret absent from every plaintext attribute (`value`/`placeholder`/`aria-*`/`title`/`outerHTML`).
- **T2** Edit keeps stored secret on blank: create via API, confirm GET masks the secret, PUT with the sentinel, re-fetch and assert no empty-string overwrite.
- **T3** Cancel discards credentials: type Access/Secret, Cancel, reopen, assert fields empty.
- **T4** Test-Connection messaging: failure path shows a clear error and never the regression string; success path asserts `Success=true` (gated to skip when MinIO/backends are down).
- **T5** Tooltip/help: each S3 field surfaces a non-empty label; help-icon hover surfaces `.ant-tooltip-inner` when present.
- Reconnaissance-first selector dump, throwaway `minioadmin/minioadmin123` fixtures, `report()`/`skip()` collectors, `sys.exit(1)` on any failure.

## Verification

| Gate | Result |
|------|--------|
| `npx vitest run ServerModal` (src/Frontend) | **4/4 passed** |
| `npx playwright test tests/e2e/s3-server.spec.ts --list` | 2 tests enumerate, no compile errors |
| `python -m py_compile tests/webapp-testing/s3_server_comprehensive_test.py` | clean |

Live E2E + webapp-testing executions are **deferred to 34-06** (no running frontend on port 7000 / no backend cluster in this Session A environment). Logged under `## 34-05` in `deferred-items.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom missing `window.matchMedia` (and `ResizeObserver`)**
- **Found during:** first `vitest run ServerModal` (all 4 specs errored before any assertion).
- **Issue:** antd's responsive observer (`Space`/`Grid` breakpoints used by ServerModal) calls `window.matchMedia` on mount; jsdom does not implement it, so every render threw `TypeError: window.matchMedia is not a function`.
- **Fix:** added no-op `matchMedia` and `ResizeObserver` stubs to the **shared** `src/test/setup.ts` (the existing Vitest `setupFiles`). This is a one-time infra fix that unblocks all future antd component tests, not just this plan's.
- **Files modified:** `src/Frontend/src/test/setup.ts`
- **Commit:** 8f2fa16

**2. [Rule 1 - Test correctness] `ltr-field` assertion on the masked Secret Key**
- **Found during:** second `vitest run` (3/4 passing; the render spec failed).
- **Issue:** `Input.Password` applies `className="ltr-field"` to its affix-wrapper `<span>`, while the inner `#SecretKey` `<input>` carries `.ant-input`. The naive `secretKey.className` check failed.
- **Fix:** assert `secretKey.closest('.ltr-field')` is truthy for the password field; plain inputs (Access Key/Bucket/Region) keep the direct className check.
- **Files modified:** `src/Frontend/src/pages/admin/components/ServerModal.test.tsx`
- **Commit:** 8f2fa16

### Shared-file touch (reported per execution constraint)

`src/Frontend/src/test/setup.ts` is outside this plan's three declared `files_modified`. The change is **additive only** (two `if (typeof … !== 'function')` guarded stubs) and does not alter existing test behaviour. It was necessary to make the mandated Vitest suite run at all.

## Threat Model Coverage

- **T-34-14 (real secret leaks into repo/CI logs):** mitigated — all three files use throwaway public fixtures (`minioadmin`/`minioadmin123`); no production secret appears.
- **T-34-15 (secret visible in UI on edit):** mitigated — Vitest asserts the edit Secret Key is the masked sentinel (never a real value); webapp-testing T1 asserts the typed secret is absent from all plaintext DOM attributes and T2 asserts blank-edit keeps the stored secret (write-only, no empty overwrite).
- **T-34-SC (npm/pip installs):** honored — no new npm or pip dependencies; Vitest/Playwright/Python-Playwright were already present.

## Known Stubs

None. The tests exercise real component rendering, real API payloads, and real DOM assertions. The conditional skips are reachability gates (not stubs) and are documented as deferred-to-34-06.

## Notes for Downstream Plans (34-06)

- Run the live tier once the app + backends + file-simulator MinIO are up:
  - `cd src/Frontend && npx playwright test s3-server` (or `--headed`)
  - `cd src/Frontend && python tests/webapp-testing/s3_server_comprehensive_test.py`
  - Env overrides: `BASE_URL`, `SERVERS_API`, `MINIO_HOST`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`.
- The UI test's add-server button matcher is bilingual (`הוסף שרת|צור שרת|Add Server|Create Server`); if the real admin-settings control differs, tighten the selector in 34-06 against the live DOM.

## Self-Check: PASSED

All three target files + SUMMARY present; both test commits (8f2fa16, 460526b) found in history (verified below).
