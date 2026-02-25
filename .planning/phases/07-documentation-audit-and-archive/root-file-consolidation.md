# Root File Consolidation Plan

## Summary

- **Total root markdown files:** 23
- **Keep at root:** 3 (README.md, CLAUDE.md, CHANGELOG.md)
- **Move to appropriate locations:** 20

## Policy

Only README.md, CLAUDE.md, and CHANGELOG.md remain at project root.
All others move to type-appropriate docs/ subdirectories.

## EXPLICIT File List with Git Commands

**IMPORTANT: Plan 02 Task 2a will execute these commands directly.**

---

### docs/releases/ (Release Artifacts - 5 files)

| Current Path | Target Path |
|--------------|-------------|
| RC2-COMPLETION-REPORT.md | docs/releases/RC2-COMPLETION-REPORT.md |
| RELEASE-NOTES-v0.1.1-rc1.md | docs/releases/RELEASE-NOTES-v0.1.1-rc1.md |
| RELEASE-PACKAGE-VERIFICATION-REPORT.md | docs/releases/RELEASE-PACKAGE-VERIFICATION-REPORT.md |
| FINAL-DEPLOYMENT-SUMMARY-v0.1.1-rc1.md | docs/releases/FINAL-DEPLOYMENT-SUMMARY-v0.1.1-rc1.md |
| PRODUCTION-READY-FINAL-REPORT.md | docs/releases/PRODUCTION-READY-FINAL-REPORT.md |

**Batch command:**
```bash
mkdir -p docs/releases
git mv "RC2-COMPLETION-REPORT.md" "docs/releases/"
git mv "RELEASE-NOTES-v0.1.1-rc1.md" "docs/releases/"
git mv "RELEASE-PACKAGE-VERIFICATION-REPORT.md" "docs/releases/"
git mv "FINAL-DEPLOYMENT-SUMMARY-v0.1.1-rc1.md" "docs/releases/"
git mv "PRODUCTION-READY-FINAL-REPORT.md" "docs/releases/"
git commit -m "docs(07-02): consolidate release artifacts to docs/releases/ (5 files)"
```

---

### docs/deployment/ (Deployment Guides - 2 files)

| Current Path | Target Path |
|--------------|-------------|
| DEPLOYMENT-PLAN-SINGLE-REPLICA.md | docs/deployment/DEPLOYMENT-PLAN-SINGLE-REPLICA.md |
| DEPLOYMENT-v0.1.1-rc1-STATUS.md | docs/deployment/DEPLOYMENT-v0.1.1-rc1-STATUS.md |

**Batch command:**
```bash
mkdir -p docs/deployment
git mv "DEPLOYMENT-PLAN-SINGLE-REPLICA.md" "docs/deployment/"
git mv "DEPLOYMENT-v0.1.1-rc1-STATUS.md" "docs/deployment/"
git commit -m "docs(07-02): consolidate deployment guides to docs/deployment/ (2 files)"
```

---

### docs/archive/presentations/ (Presentations - 2 files)

| Current Path | Target Path |
|--------------|-------------|
| EZ_Platform_Presentation.md | docs/archive/presentations/EZ_Platform_Presentation.md |
| EZ_Platform_Presentation_Hebrew.md | docs/archive/presentations/EZ_Platform_Presentation_Hebrew.md |

**Batch command:**
```bash
mkdir -p docs/archive/presentations
git mv "EZ_Platform_Presentation.md" "docs/archive/presentations/"
git mv "EZ_Platform_Presentation_Hebrew.md" "docs/archive/presentations/"
git commit -m "docs(07-02): archive presentations (2 files)"
```

---

### docs/archive/operational-logs/ (Operational Logs - 7 files)

| Current Path | Target Path |
|--------------|-------------|
| SYNC-TO-GITHUB.md | docs/archive/operational-logs/SYNC-TO-GITHUB.md |
| SYNC-VERIFICATION-COMPLETE.md | docs/archive/operational-logs/SYNC-VERIFICATION-COMPLETE.md |
| GIT-SYNC-CRITICAL-STATUS.md | docs/archive/operational-logs/GIT-SYNC-CRITICAL-STATUS.md |
| GIT-REPOSITORY-CLEANUP-REPORT.md | docs/archive/operational-logs/GIT-REPOSITORY-CLEANUP-REPORT.md |
| CLUSTER-RECOVERY-STATUS.md | docs/archive/operational-logs/CLUSTER-RECOVERY-STATUS.md |
| RECOVERY-STEPS.md | docs/archive/operational-logs/RECOVERY-STEPS.md |
| PRODUCTION-SYNC-STATUS.md | docs/archive/operational-logs/PRODUCTION-SYNC-STATUS.md |

**Batch command:**
```bash
mkdir -p docs/archive/operational-logs
git mv "SYNC-TO-GITHUB.md" "docs/archive/operational-logs/"
git mv "SYNC-VERIFICATION-COMPLETE.md" "docs/archive/operational-logs/"
git mv "GIT-SYNC-CRITICAL-STATUS.md" "docs/archive/operational-logs/"
git mv "GIT-REPOSITORY-CLEANUP-REPORT.md" "docs/archive/operational-logs/"
git mv "CLUSTER-RECOVERY-STATUS.md" "docs/archive/operational-logs/"
git mv "RECOVERY-STEPS.md" "docs/archive/operational-logs/"
git mv "PRODUCTION-SYNC-STATUS.md" "docs/archive/operational-logs/"
git commit -m "docs(07-02): archive operational logs (7 files)"
```

---

### docs/archive/status-reports/ (Status Reports - 4 files)

| Current Path | Target Path |
|--------------|-------------|
| SWAGGER-COMPLETE-STATUS.md | docs/archive/status-reports/SWAGGER-COMPLETE-STATUS.md |
| SWAGGER-VERIFICATION-REPORT.md | docs/archive/status-reports/SWAGGER-VERIFICATION-REPORT.md |
| REPOSITORY-ANALYSIS-SUMMARY.md | docs/archive/status-reports/REPOSITORY-ANALYSIS-SUMMARY.md |
| CONTINUE-FROM-HERE-SESSION-5.md | docs/archive/sessions/2025-12/CONTINUE-FROM-HERE-SESSION-5.md |

**Note:** CONTINUE-FROM-HERE-SESSION-5.md is handled in session-logs-archive-plan.md (goes to sessions/2025-12/).

**Batch command:**
```bash
mkdir -p docs/archive/status-reports
git mv "SWAGGER-COMPLETE-STATUS.md" "docs/archive/status-reports/"
git mv "SWAGGER-VERIFICATION-REPORT.md" "docs/archive/status-reports/"
git mv "REPOSITORY-ANALYSIS-SUMMARY.md" "docs/archive/status-reports/"
git commit -m "docs(07-02): archive status reports (3 files)"
```

---

## Files Remaining at Root (3)

| File | Reason |
|------|--------|
| README.md | Project entry point |
| CLAUDE.md | AI assistant instructions |
| CHANGELOG.md | Version history |

---

## Verification After Consolidation

```bash
# List root markdown files
ls -1 *.md
# Expected: CHANGELOG.md, CLAUDE.md, README.md

# Verify files moved
ls docs/releases/*.md | wc -l
# Expected: 5

ls docs/deployment/*.md | wc -l
# Expected: 2

ls docs/archive/presentations/*.md | wc -l
# Expected: 2

ls docs/archive/operational-logs/*.md | wc -l
# Expected: 7

ls docs/archive/status-reports/*.md | wc -l
# Expected: 3
```

---

*Generated: 2026-02-02*
*Total root files: 23*
*Keeping at root: 3*
*Moving: 20 (1 handled in session-logs-archive-plan.md)*
