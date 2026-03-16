---
phase: 17
slug: file-simulator-integration
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-16
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | dotnet build (compilation check — no test project for DemoDataGenerator) |
| **Config file** | tools/DemoDataGenerator/DemoDataGenerator.csproj |
| **Quick run command** | `cd tools/DemoDataGenerator && dotnet build --no-restore` |
| **Full suite command** | `cd tools/DemoDataGenerator && dotnet build` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd tools/DemoDataGenerator && dotnet build --no-restore`
- **After every plan wave:** Run `cd tools/DemoDataGenerator && dotnet build`
- **Before `/gsd:verify-work`:** Full build must be green + manual smoke test with `--use-simulator --upload-files`
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | SIM-03 | build | `dotnet build` | ✅ | ⬜ pending |
| 17-01-02 | 01 | 1 | SIM-03 | build | `dotnet build` | ✅ | ⬜ pending |
| 17-01-03 | 01 | 1 | SIM-01 | build | `dotnet build` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 2 | SIM-02, SIM-03 | build | `dotnet build` | ✅ | ⬜ pending |
| 17-02-02 | 02 | 2 | SIM-02 | build | `dotnet build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or test project needed.

DemoDataGenerator has no test project — validation is via compilation and manual smoke testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Files uploaded to simulator servers | SIM-03 | Requires live file-simulator cluster | Run `dotnet run -- --use-simulator --upload-files --simulator-url http://172.17.89.141:30500` and verify files appear on servers |
| DataSources created with schemas | SIM-02 | Requires live MongoDB + API | Run with `--use-simulator --create-servers` and check MongoDB for DataSource entities |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-16
