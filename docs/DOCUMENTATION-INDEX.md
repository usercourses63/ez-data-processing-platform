---
last-verified: 2026-02-02
status: current
---
# EZ Data Processing Platform - Documentation Index

**Last Updated:** February 2, 2026
**Purpose:** Master index and organization guide for all project documentation

---

## Consolidated Guides (Primary)

| Guide | Description |
|-------|-------------|
| **[Architecture Guide](./architecture/ARCHITECTURE.md)** | System architecture, operations, development patterns, design decisions |
| **[Deployment Guide](./deployment/DEPLOYMENT.md)** | Kubernetes deployment, configuration, scaling, OCP compliance |
| **[Testing Guide](./testing/TESTING.md)** | E2E-first strategy, running tests, patterns, coverage |

---

## Quick Reference

| Document | Location | Status | Purpose |
|----------|----------|--------|---------|
| **README** | `../README.md` | Current | Project entry point |
| **CLAUDE.md** | `../CLAUDE.md` | Current | AI assistant configuration |
| **Architecture Guide** | `architecture/ARCHITECTURE.md` | Current | Consolidated architecture documentation |
| **Deployment Guide** | `deployment/DEPLOYMENT.md` | Current | Consolidated deployment documentation |
| **Testing Guide** | `testing/TESTING.md` | Current | Consolidated testing documentation |
| **Product Requirements** | `data_processing_prd.md` | Reference | Original requirements specification |
| **Archive** | `archive/` | Archive | Historical documentation |

---

## Documentation Organization

### Current Structure

```
docs/
├── DOCUMENTATION-INDEX.md           This file
├── data_processing_prd.md           Product requirements
├── PROJECT_STANDARDS.md             Development standards
├── PROJECT-STRUCTURE.md             Architecture overview
├── MONITORING-INFRASTRUCTURE.md     Infrastructure setup
│
├── architecture/                    Architecture documentation
│   ├── SYSTEM-ARCHITECTURE.md       System architecture
│   ├── corrected-pipeline-flow.md   Pipeline flow diagrams
│   └── exports/                     Exported diagrams (PDF, MD, SVG)
│
├── deployment/                      Deployment documentation
│   ├── DEPLOYMENT-PLAN-SINGLE-REPLICA.md
│   ├── DEPLOYMENT-v0.1.1-rc1-STATUS.md
│   └── INGRESS-SETUP-GUIDE.md
│
├── frontend/                        Frontend documentation
│   ├── README.md                    Frontend overview
│   └── FRONTEND-ARCHITECTURE-REVIEW.md
│
├── installation/                    Installation guides
│   ├── INSTALLATION-GUIDE.md
│   └── HELM-INSTALLATION.md
│
├── maintenance/                     Maintenance guides
│   └── DOCKER-CLEANUP-GUIDE.md
│
├── reference/                       Reference documentation
│   ├── SCHEMA-BUILDER-USER-GUIDE.md
│   ├── HOW-TO-SEE-METRICS-UI.md
│   └── CRON-HELPER-IMPLEMENTATION.md
│
├── releases/                        Release documentation
│   ├── RELEASE-NOTES-v0.1.0-beta.md
│   ├── RELEASE-NOTES-v0.1.1-rc1.md
│   ├── RC2-COMPLETION-REPORT.md
│   └── RELEASE-PACKAGE-VERIFICATION-REPORT.md
│
├── testing/                         Testing documentation
│   ├── file-simulator-setup.md      File simulator configuration
│   ├── E2E-GAP-ANALYSIS-REPORT.md   E2E test gap analysis
│   ├── STRESS-TEST-*.md             Stress test reports
│   └── VALID-SCHEMA-TEST-REPORT.md  Schema validation tests
│
├── troubleshooting/                 Troubleshooting guides
│   ├── port-forwarding-fix.md
│   ├── task-orchestrator-mcp-usage.md
│   └── v0.2.0-browser-cache-issue.md
│
└── archive/                         Archived documentation
    ├── sessions/                    Session logs by month
    │   ├── index.md                 Session logs index
    │   ├── 2025-10/                 October 2025 sessions
    │   ├── 2025-11/                 November 2025 sessions
    │   └── 2025-12/                 December 2025 sessions
    ├── planning/                    Legacy planning docs
    ├── presentations/               Product presentations
    ├── operational-logs/            Git sync, recovery logs
    ├── status-reports/              Historical status reports
    └── deprecated/                  Deprecated documentation
```

---

## Archive

Documentation preserved for historical reference:

- [Session Logs Archive](./archive/sessions/index.md) - Development session logs by month (40 files)
- [Planning Archive](./archive/planning/) - Historical planning documents (superseded by .planning/)
- [Presentations](./archive/presentations/) - Product presentations (English and Hebrew)
- [Operational Logs](./archive/operational-logs/) - Sync, recovery, and git operation logs
- [Status Reports](./archive/status-reports/) - Historical status and verification reports

**Note:** Planning documents are now managed through the GSD system in `.planning/` directory. The `docs/archive/planning/` contains legacy planning documentation preserved for historical reference.

---

## Releases

Release documentation:

- [Release Notes v0.1.1-rc1](./releases/RELEASE-NOTES-v0.1.1-rc1.md) - Current release
- [Release Notes v0.1.0-beta](./releases/RELEASE-NOTES-v0.1.0-beta.md) - Beta release
- [RC2 Completion Report](./releases/RC2-COMPLETION-REPORT.md) - RC2 milestone report
- [Release Package Verification](./releases/RELEASE-PACKAGE-VERIFICATION-REPORT.md) - Package verification

---

## Deployment

**Primary:** [Deployment Guide](./deployment/DEPLOYMENT.md) - Consolidated deployment documentation

Reference documentation:
- [Deployment Plan (Single Replica)](./deployment/DEPLOYMENT-PLAN-SINGLE-REPLICA.md) - Detailed single replica setup
- [Installation Guide](./installation/INSTALLATION-GUIDE.md) - Step-by-step installation

---

## Testing

**Primary:** [Testing Guide](./testing/TESTING.md) - Consolidated testing documentation

Reference documentation:
- [E2E Gap Analysis](./testing/E2E-GAP-ANALYSIS-REPORT.md) - E2E test coverage analysis
- [File Simulator Setup](./testing/file-simulator-setup.md) - Test environment configuration
- [Hazelcast TTL Configuration](./testing/HAZELCAST-TTL-CONFIGURATION.md) - Cache configuration

---

## Architecture

**Primary:** [Architecture Guide](./architecture/ARCHITECTURE.md) - Consolidated architecture documentation

Reference documentation:
- [System Architecture](./architecture/SYSTEM-ARCHITECTURE.md) - Detailed system design
- [Project Standards](./PROJECT_STANDARDS.md) - Development standards

---

## Reference

Technical reference documentation:

- [Schema Builder User Guide](./reference/SCHEMA-BUILDER-USER-GUIDE.md) - How to use schema builder
- [Metrics UI Guide](./reference/HOW-TO-SEE-METRICS-UI.md) - Accessing metrics UI
- [Cron Helper](./reference/CRON-HELPER-IMPLEMENTATION.md) - Cron expression helper
- [Schema-DataSource Architecture](./reference/SCHEMA-DATASOURCE-ARCHITECTURE-RECOMMENDATION.md) - Architecture decisions

---

## Document Status Legend

- **Current** - Active and up-to-date
- **Reference** - Stable reference material
- **Archive** - Historical/superseded
- **Deprecated** - No longer relevant

---

## Planning (GSD System)

Active planning is managed through the GSD (Get Shit Done) system:

- **Location:** `.planning/` directory
- **Phases:** See `.planning/ROADMAP.md` for phase overview
- **Current State:** See `.planning/STATE.md` for current progress
- **Plans:** See `.planning/phases/` for phase-specific plans

The GSD system is the single source of truth for all planning and execution documentation.

---

**Document Maintained By:** Project Development Team
**Last Major Update:** February 2, 2026
**Version:** 2.0 (Post-Documentation Audit)
