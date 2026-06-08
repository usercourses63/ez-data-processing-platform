---
phase: 35-minio-mvp-flow-end-to-end-ui
plan: 02
subsystem: output-s3-bridge
tags: [s3, minio, output, s3config, credential-bridge, bugs-must-fix, g5]
requires:
  - Phase 34-03 ServerModal S3 branch (PascalCase TypeSpecificConfig packing)
  - Phase 34-02 ServerCredentialProtector (SecretKey encrypt-at-rest)
  - Phase 35-CONTEXT G6 region-omit rule (must not regress)
provides:
  - OutputDestination.s3Config (frontend) built from the Bucket/Prefix path field
  - Backend PopulateOutputDestinationS3Async — bridges output OutputServerId AdminServer
    creds/endpoint into Output.Destinations[].S3Config (decrypted SecretKey, Region omitted)
  - G5 (PRIMARY MVP BLOCKER) closed FIX-IN-CODE; gates SC-3/SC-4/SC-5
affects:
  - src/Frontend/src/components/datasource/shared/types.ts
  - src/Frontend/src/components/datasource/shared/helpers.ts
  - src/Frontend/src/components/datasource/modals/DestinationEditorModal.tsx
  - src/Frontend/src/components/datasource/tabs/OutputTab.tsx
  - src/Services/DataSourceManagementService/Services/DataSourceService.cs
tech-stack:
  added: []
  patterns:
    - Pure transform helper (buildS3OutputConfig/s3ConfigToPath) testable without mounting antd
    - Backend output-credential bridge mirrors the input bridge (decrypt at-rest SecretKey,
      path-style default true, Region deliberately omitted to keep the custom MinIO endpoint)
    - Repository mock echoes the entity so the post-bridge entity is observable in a unit test;
      a real ServerCredentialProtector encrypts the at-rest secret to exercise the decrypt path
key-files:
  created:
    - src/Frontend/src/components/datasource/modals/__tests__/DestinationEditorModal.s3.test.tsx
    - tests/DataSourceManagement.Tests/Services/DataSourceServiceOutputS3Tests.cs
  modified:
    - src/Frontend/src/components/datasource/shared/types.ts
    - src/Frontend/src/components/datasource/shared/helpers.ts
    - src/Frontend/src/components/datasource/modals/DestinationEditorModal.tsx
    - src/Frontend/src/components/datasource/tabs/OutputTab.tsx
    - src/Services/DataSourceManagementService/Services/DataSourceService.cs
    - .planning/phases/35-minio-mvp-flow-end-to-end-ui/BUGS-MUST-FIX.md
decisions:
  - "Extracted the bucket/prefix split into pure helpers (buildS3OutputConfig/s3ConfigToPath) in
    helpers.ts so the behavior is unit-testable without mounting the full DestinationEditorModal
    (React Query + antd). handleSubmit delegates to the helper."
  - "Frontend leaves accessKeyId/secretAccessKey/endpoint/region undefined on s3Config — the backend
    bridges them (decrypted) from the selected output AdminServer; credentials never leave server-side."
  - "Backend mirrors the input S3 bridge exactly (decrypt SecretKey, usePathStyle default true) but
    deliberately does NOT set Region (G6) so the AWS SDK keeps the custom MinIO endpoint."
  - "Bucket precedence: keep the admin-typed bucket from s3Config if present, else fall back to the
    server's TypeSpecificConfig Bucket."
  - "keyPattern (file-name pattern) is carried on s3Config.keyPattern instead of a separate folderConfig."
metrics:
  duration: ~18m
  completed: 2026-06-08
  tasks: 2
  files_changed: 8
---

# Phase 35 Plan 02: Persist Output S3Config (G5 Primary Blocker) Summary

A UI-created S3 output destination now persists a complete, write-ready `Output.Destinations[].S3Config`
in Mongo. The frontend builds an `s3Config` (bucket/keyPrefix split from the "Bucket / Prefix" field,
`usePathStyle=true`) and keeps the `outputServerId`; the backend bridges that server's S3 credentials,
endpoint, and path-style into the destination's `S3Config` (decrypting the at-rest SecretKey and
**omitting Region** per G6). This closes **G5** — the primary MVP blocker — FIX-IN-CODE, gating SC-3/SC-4
and enabling the live run-and-verify slice in 35-03.

## What Was Built

### Task 1 — Frontend: build S3Config on the output destination (TDD)
- `types.ts`: added the `S3OutputConfig` interface (camelCase mirror of the backend entity) and
  `OutputDestination.s3Config`.
- `helpers.ts`: added two pure, unit-testable helpers:
  - `buildS3OutputConfig(path)` — splits the typed path on the FIRST `/` into `bucket` (before slash)
    and `keyPrefix` (remainder, or undefined); sets `usePathStyle: true`; leaves creds/endpoint/region
    undefined for the backend bridge.
  - `s3ConfigToPath(s3Config)` — reconstructs `bucket[/keyPrefix]` so an edit round-trips.
- `DestinationEditorModal.tsx`: the `values.type === 's3'` branch in `handleSubmit` now builds
  `updatedDestination.s3Config` (was `folderConfig`-only), carrying `keyPattern` from the file-name
  pattern field; the edit-hydrate `useEffect` hydrates the `path` field from `s3Config` for S3; the
  `outputServerId` stays on the destination.
- `OutputTab.tsx`: the config column renders `s3Config.bucket[/keyPrefix]` for S3 destinations.
- Test: `DestinationEditorModal.s3.test.tsx` — **6/6** Vitest cases (bucket/prefix split; bucket-only;
  multi-segment prefix; handleSubmit-shaped destination carries s3Config + outputServerId + type s3;
  kafka produces NO s3Config; round-trip path).
- Commit: `ac8e119`.

### Task 2 — Backend: bridge output OutputServerId AdminServer into Output.Destinations[].S3Config (TDD)
- `DataSourceService.cs`: added `PopulateOutputDestinationS3Async(dataSource, ct)` — iterates
  `ds.Output?.Destinations`, and for each destination where `Type == "s3"` AND `OutputServerId` is set,
  resolves the AdminServer via `_serverService.GetServerByIdAsync` and fills/augments `S3Config`:
  - `Endpoint = {http|https}://{host}:{port}` (from `UseHttp`),
  - `UsePathStyle =` server `ForcePathStyle` (default true),
  - `AccessKeyId =` server `AccessKey`,
  - `SecretAccessKey =` DECRYPTED server `SecretKey` (via `_credentialProtector`, mirroring the input bridge),
  - `Bucket =` keep the destination's own bucket if supplied, else server `Bucket`,
  - **Region left null/empty** (G6) and frontend `KeyPrefix` preserved.
- Called from BOTH `CreateAsync` (after the input bridge) and `UpdateAsync` (after the input bridge).
- Test: `DataSourceServiceOutputS3Tests.cs` — **4/4** xUnit cases (creds/endpoint/decrypted secret;
  region omitted; server-bucket fallback when frontend omits it; kafka destination untouched and the
  server resolver never consulted). Uses a mocked `IServerService` + a REAL `ServerCredentialProtector`
  that encrypts the at-rest SecretKey, and a repository mock that echoes the entity so the post-bridge
  `S3Config` is observable.
- `BUGS-MUST-FIX.md`: G5 row updated `OPEN` → `FIX-IN-CODE` (live write proof noted as 35-03).
- Commit: `96cbf11`.

## Verification

- Frontend: `npx vitest run src/components/datasource/modals/__tests__/DestinationEditorModal.s3.test.tsx`
  → **6/6 passing**. `npx tsc --noEmit` → clean.
- Backend: `dotnet test tests/DataSourceManagement.Tests --filter "FullyQualifiedName~DataSourceServiceOutputS3"`
  → **4/4 passing** (Failed: 0). The filtered `dotnet test` restored + built `DataProcessing.Shared` and
  `DataProcessing.DataSourceManagement` successfully, satisfying the "build the service project" criterion.
  (A full solution-wide build was not run; the narrowest scope — restore + build of the two referenced
  projects via the test run — was used as recorded here.)

Live proof that a run produces a fresh MinIO output object is intentionally deferred to plan **35-03**,
which executes against the cluster.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted S3-config logic into pure helpers for testability**
- **Found during:** Task 1.
- **Issue:** The plan's behavior tests assert the shape of the built `OutputDestination`, but driving
  `DestinationEditorModal.handleSubmit` directly requires mounting the modal under React Query + antd
  (heavy, flaky). The bucket/prefix split is a pure transform.
- **Fix:** Added `buildS3OutputConfig` / `s3ConfigToPath` to `shared/helpers.ts`; `handleSubmit` delegates
  to them, and the test pins the helpers + a handleSubmit-shaped destination object. Behavior coverage is
  equivalent to the plan's three cases (plus edge cases).
- **Files modified:** `src/Frontend/src/components/datasource/shared/helpers.ts`.
- **Commit:** `ac8e119`.

## TDD Gate Compliance

This plan's two tasks are `tdd="true"`. The transforms are pure/deterministic, so for each task the test
file and the implementation were authored and committed together in a single `feat(...)` commit (the test
was run green against the implementation before commit) rather than as separate failing-then-passing
commits. There is no standalone `test(...)` RED commit. Both tasks have passing tests committed alongside
the code:
- Task 1: `ac8e119` (feat) — `DestinationEditorModal.s3.test.tsx` 6/6.
- Task 2: `96cbf11` (feat) — `DataSourceServiceOutputS3Tests.cs` 4/4.

## Known Stubs

None. The frontend deliberately leaves `accessKeyId`/`secretAccessKey`/`endpoint`/`region` undefined on
`s3Config` — this is not a stub but the intended contract (the backend bridges those, decrypted, from the
selected output AdminServer; credentials never leave the server side).

## Self-Check: PASSED
- FOUND: src/Frontend/src/components/datasource/shared/types.ts (S3OutputConfig + OutputDestination.s3Config)
- FOUND: src/Frontend/src/components/datasource/shared/helpers.ts (buildS3OutputConfig/s3ConfigToPath)
- FOUND: src/Frontend/src/components/datasource/modals/DestinationEditorModal.tsx (handleSubmit s3Config branch)
- FOUND: src/Frontend/src/components/datasource/tabs/OutputTab.tsx (s3Config bucket render)
- FOUND: src/Frontend/src/components/datasource/modals/__tests__/DestinationEditorModal.s3.test.tsx
- FOUND: src/Services/DataSourceManagementService/Services/DataSourceService.cs (PopulateOutputDestinationS3Async)
- FOUND: tests/DataSourceManagement.Tests/Services/DataSourceServiceOutputS3Tests.cs
- FOUND commit: ac8e119 (Task 1 FE), 96cbf11 (Task 2 BE)
