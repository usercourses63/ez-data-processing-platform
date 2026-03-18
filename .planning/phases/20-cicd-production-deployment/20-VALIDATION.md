---
phase: 20
slug: cicd-production-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | bash/curl (infrastructure validation) |
| **Config file** | none — uses kubectl, helm, curl |
| **Quick run command** | `kubectl get pods -n ez-platform -o wide` |
| **Full suite command** | `bash scripts/validate-deployment.sh` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `kubectl get pods -n ez-platform`
- **After every plan wave:** Run health check validation
- **Before `/gsd:verify-work`:** Full deployment validation must pass
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | PROD-01 | infra | `grep 'helm-validate' .github/workflows/ci.yml` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | PROD-01 | infra | `helm lint helm/ez-platform/` | ✅ | ⬜ pending |
| 20-02-01 | 02 | 1 | PROD-03 | unit | `grep '__APP_VERSION__' src/Frontend/vite.config.ts` | ✅ | ⬜ pending |
| 20-02-02 | 02 | 1 | PROD-05 | infra | `helm template --set-string global.version=test helm/ez-platform/ \| grep resources` | ✅ | ⬜ pending |
| 20-03-01 | 03 | 2 | PROD-04 | infra | `helm template -f helm/ez-platform/values-local.yaml helm/ez-platform/ \| grep replicas` | ❌ W0 | ⬜ pending |
| 20-04-01 | 04 | 2 | PROD-06 | e2e | `curl -s http://localhost:30080/health` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `values-local.yaml` — local production Helm values (PROD-04)
- [ ] CI workflow updates — Helm validate job (PROD-01)

*Existing infrastructure covers most phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Frontend footer version display | PROD-03 | Visual verification | Open frontend, check footer shows correct v0.2.0 version |
| Release-package smoke test | PROD-06 | Requires full deployment | Deploy release-package, verify CRUD + health endpoints |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
