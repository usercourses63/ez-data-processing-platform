---
phase: 34
slug: s3-minio-connector-iam-credentials-bug-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 34-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frontend unit** | Vitest + jsdom (`src/Frontend/`) |
| **Frontend E2E** | Playwright (`src/Frontend/tests/e2e/`, Edge/Chrome channel, BASE_URL env) |
| **Backend unit/integration** | xUnit (`src/Services/*.Tests/`); connector↔MinIO integration via existing `tests/IntegrationTests/Connectors/S3ConnectorTests.cs` (Testcontainers or live file-simulator MinIO) |
| **Quick run command** | `cd src/Frontend && npx vitest run` · backend: `dotnet test src/Services/DataSourceManagementService.Tests` |
| **Full suite command** | backend `dotnet test` (S3 connector + ServerService) + `npm run test:e2e:sanity` |
| **Estimated runtime** | ~2–4 min full |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (vitest run / dotnet test for the changed project).
- **After every plan wave:** Run the full suite for the affected tier.
- **Before validation check:** Backend S3 connector + ServerService tests green; E2E S3 create→test-connection green.
- **Max feedback latency:** ~120 seconds (per-project quick run).

---

## Per-Task Verification Map (skeleton — planner fills task IDs)

| Success Criterion | Tier | Secure Behavior | Test Type | Automated Command | Status |
|---|---|---|---|---|---|
| SC-1 Root cause documented | — | — | doc (RESEARCH.md) | n/a (artifact) | ✅ |
| SC-2 UI Access/Secret fields (S3 branch) | frontend | secret rendered as masked Input.Password, LTR | unit + E2E | `vitest run` (ServerModal S3 branch) · Playwright | ⬜ pending |
| SC-3 DTO carries AccessKey/SecretKey, secret write-only | backend | SecretKey never echoed in GET response | unit + integration | `dotnet test` (DTO mapping + controller GET masks secret) | ⬜ pending |
| SC-4 Persistence secured at rest, never logged | backend | secret encrypted in TypeSpecificConfig / secret-ref; redacted in logs | unit + integration | `dotnet test` (ServerCredentials round-trip + ToString redaction) | ⬜ pending |
| SC-5 Connection flow authenticates (no IAM-missing) | backend | static creds reach S3Connector | integration | `dotnet test` S3ConnectorTests + ServerService.TestConnectionAsync | ⬜ pending |
| SC-6 Live MinIO request succeeds | backend/integration | test-connection 200 + listing | integration (live/Testcontainer) | `dotnet test` against file-simulator MinIO | ⬜ pending (needs Session B creds) |
| SC-7 Unit + integration + E2E all pass | all | — | unit+integration+E2E | full suite | ⬜ pending |
| SC-8 End-to-end validation (discover/pull S3) | E2E | — | E2E/manual | simulation + backends + Playwright | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Backend unit test stubs for the S3 DTO↔ServerCredentials credential mapping (PascalCase key contract: `AccessKey`/`SecretKey`/`Bucket`/`Region`/`ForcePathStyle`/`UseHttp`).
- [ ] Controller GET-masks-secret integration test stub (write-only secret).
- [ ] Frontend Vitest stub for ServerModal S3 branch (Access/Secret fields render; secret masked).
- [ ] Playwright E2E spec stub: create S3 server → Test Connection → success.
- [ ] Confirm/extend `S3ConnectorTests.cs` to assert the empty-credentials path raises (regression for the IAM-missing bug) and the populated path authenticates.

*Existing `S3ConnectorTests.cs` already covers populated-credential auth against MinIO — reuse it.*

---

## Manual-Only Verifications

| Behavior | Criterion | Why Manual | Test Instructions |
|---|---|---|---|
| Live discover/pull of an object from the file-simulator MinIO bucket | SC-8 | Needs Session B MinIO bucket + keys and both clusters up | Provision via CLUSTER-COORDINATION.md; create S3 server in UI with creds; run file discovery; confirm object pulled |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
