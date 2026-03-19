---
phase: 22
slug: signalr-monitoring-data-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (E2E, browser UI), dotnet test (integration), kubectl/curl (infrastructure) |
| **Config file** | `src/Frontend/playwright.config.ts` |
| **Quick run command** | `kubectl logs deployment/datasource-management -n ez-platform --tail=50 \| grep -i "broadcast\|monitoring\|error"` |
| **Full suite command** | `cd src/Frontend && npx playwright test --headed` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick log check command
- **After every plan wave:** Run full Playwright suite + log verification
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | MON-08 | infra | `kubectl get clusterrolebinding -n ez-platform \| grep nas-pv-manager` | ❌ W0 | ⬜ pending |
| 22-01-02 | 01 | 1 | MON-08 | infra | `kubectl logs deployment/datasource-management -n ez-platform --tail=30 \| grep -i "pod\|kubernetes"` | ❌ W0 | ⬜ pending |
| 22-01-03 | 01 | 1 | MON-09 | infra | `curl -s http://localhost:5001/health \| grep -i prometheus` | ❌ W0 | ⬜ pending |
| 22-01-04 | 01 | 1 | MON-10 | infra | `kubectl logs deployment/datasource-management -n ez-platform --tail=30 \| grep -i "kafka\|queue"` | ❌ W0 | ⬜ pending |
| 22-01-05 | 01 | 1 | MON-11 | infra | `kubectl logs deployment/datasource-management -n ez-platform --tail=30 \| grep -i "jaeger\|trace"` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 2 | MON-12 | manual | Browser: System Monitoring page shows real K8s pods | N/A | ⬜ pending |
| 22-02-02 | 02 | 2 | MON-13 | unit | `test -f src/Frontend/src/services/monitoring-mock-data.ts && echo EXISTS \|\| echo DELETED` | ✅ | ⬜ pending |
| 22-03-01 | 03 | 3 | CRUD-SYNC | E2E | Playwright: open 2 tabs, create DataSource in tab 1, verify tab 2 list updates | ❌ W0 | ⬜ pending |
| 22-03-02 | 03 | 3 | CRUD-LOCK | integration | `dotnet test src/Services/DataSourceManagementService.Tests --filter OptimisticLock` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/Frontend/tests/e2e/multi-user-sync.spec.ts` — stubs for CRUD broadcast tests
- [ ] `src/Services/DataSourceManagementService.Tests/OptimisticLockingTests.cs` — stubs for 409 conflict tests
- [ ] RBAC verification script or kubectl commands documented in plan

*Existing Playwright infrastructure covers monitoring UI verification. Wave 0 adds multi-user sync and optimistic locking stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System Monitoring K8s tab shows real pods | MON-08 | Requires live cluster | Open http://localhost:7000, go to System Monitoring, check Kubernetes tab shows actual pods |
| System Monitoring Prometheus tab shows real metrics | MON-09 | Requires live Prometheus | Check Prometheus tab shows gauge/counter values |
| System Monitoring Kafka tab shows queue depths | MON-10 | Requires live Kafka | Check Kafka tab shows topic queue depths |
| System Monitoring Jaeger tab shows traces | MON-11 | Requires live Jaeger | Check Jaeger tab shows recent traces |
| Loading skeleton appears before SignalR connects | MON-12 | Timing-dependent | Slow network throttle + observe skeleton before real data |
| 2nd user sees changes made by 1st user in real-time | CRUD-SYNC | Multi-browser | Open 2 browser windows, create DataSource in one, verify list updates in other within 5s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
