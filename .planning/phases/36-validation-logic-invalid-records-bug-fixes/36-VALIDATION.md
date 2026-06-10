---
phase: 36
slug: validation-logic-invalid-records-bug-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Every bug (B1–B4) gets a RED reproducing test before its fix; the fix turns it GREEN.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Backend: xUnit (`dotnet test`). Frontend unit: Vitest. E2E: Playwright (`baseURL http://localhost:7000`). Comprehensive UI: webapp-testing (Python Playwright). |
| **Config file** | `src/Frontend/vitest.config.ts`, `src/Frontend/playwright.config.ts`; backend per-service `*.Tests.csproj` |
| **Quick run command** | Backend: `dotnet test src/Services/ValidationService.Tests` / `...InvalidRecordsService.Tests`. Frontend: `cd src/Frontend && npm run test:unit` |
| **Full suite command** | Backend `dotnet test` (touched test projects) + `cd src/Frontend && npm run test:unit && npm run test:e2e` + webapp-testing pass |
| **Estimated runtime** | unit ~30–90s; integration ~2–5m (needs cluster); E2E ~2–4m |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick unit command (Vitest for frontend schema-gen fixes B1–B3; xUnit for backend converter/InvalidRecords fixes).
- **After every plan wave:** Run the full suite for the touched area.
- **Before `/gsd-verify-work`:** Full suite green AND the Phase-35 MinIO MVP flow still passes (no regression).
- **Max feedback latency:** ~90s for unit; integration/E2E gated per wave.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 36-01-01 | 01 | 0 | B1–B4 repro | — | N/A | unit | `dotnet test ...Tests` / `npm run test:unit` | ❌ W0 | ⬜ pending |

*Planner/executor fill the full map. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Per RESEARCH, the backend test projects do **not exist yet** — Wave 0 must create them before the RED repros:

- [ ] `src/Services/ValidationService.Tests/` (xUnit project) — RED tests for B1 (optional-empty), B2 (optional-empty `date`), B3 (`koko` `tararich` header-mapping), using the verbatim MinIO CSV bytes + live `koko` schema as fixtures
- [ ] `src/Services/InvalidRecordsService.Tests/` (xUnit project) — RED tests for B4 (paging/index + missing SignalR broadcast)
- [ ] Frontend Vitest specs for the schema-generation fixes (`schemaInferrer`, `schemaAutoSuggest`) — B1/B2 optional modeling, B3 header→field handling
- [ ] Playwright + webapp-testing additions for the Invalid Records page (B4 show-all + latency)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| B4 latency improvement (before/after numbers) | B4 | Requires live cluster + realistic invalid-record volume | Record InvalidRecords list API p95 before fix, re-measure after Mongo index + repo paging fix; assert measurable drop |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the two backend test projects + frontend specs)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s (unit)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
