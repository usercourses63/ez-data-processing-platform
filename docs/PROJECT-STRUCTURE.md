---
last-verified: 2026-02-02
status: current
---
# EZ Data Processing Platform - Project Structure

## Overview
This document describes the organized project structure after cleanup on September 30, 2025.

---

## Root Directory Structure

```
EZ/
├── .editorconfig                    # Editor configuration
├── .gitignore                       # Git ignore rules
├── DataProcessingPlatform.sln       # Solution file
├── Directory.Build.props            # MSBuild common properties
├── docker-compose.development.yml   # Development Docker setup
├── global.json                      # .NET SDK version
├── README.md                        # Project README (to be created)
│
├── .augment/                        # Augment AI integration
├── .clinerules/                     # Cline AI rules
├── .github/                         # GitHub workflows and configs
│
├── deploy/                          # Deployment configurations
│   ├── docker/                      # Docker templates
│   ├── kubernetes/                  # Kubernetes YAML files
│   ├── helm/                        # Helm charts
│   ├── prometheus/                  # Prometheus configs
│   └── grafana/                     # Grafana dashboards
│
├── docs/                            # Documentation
│   ├── data_processing_prd.md       # Product Requirements
│   ├── PROJECT_STANDARDS.md         # Development standards
│   ├── project-progress.md          # Progress tracking
│   ├── shrimp-rules.md              # AI agent rules
│   ├── PROJECT-STRUCTURE.md         # This file
│   ├── archive/                     # Archived old docs
│   │   ├── CLAUDE.md
│   │   └── detailed-implementation-plan.md
│   ├── mockups/                     # UI mockups
│   │   └── web_ui_mockups_hebrew.html
│   └── planning/                    # Implementation planning
│       ├── README.md                # Planning docs index
│       ├── FINAL-CORRECTED-ARCHITECTURE.md ⭐ Main reference
│       ├── METRICS-ARCHITECTURE-CORRECTED.md
│       ├── IMPLEMENTATION-SUMMARY.md
│       ├── frontend-backend-implementation-plan.md
│       ├── frontend-backend-implementation-plan-continued.md
│       ├── metrics-configuration-extended-plan.md
│       ├── metrics-configuration-extended-plan-part2.md
│       └── COMPREHENSIVE-IMPLEMENTATION-PLAN.md
│
├── sample-data/                     # Test and demo data
│   ├── datasource-hebrew-1.json     # Israeli banking demo
│   ├── datasource-hebrew-2.json     # Retail demo
│   ├── datasource-hebrew-3.json     # Healthcare demo
│   ├── datasource-hebrew-4.json     # Automotive demo
│   ├── datasource-hebrew-5.json     # Education demo
│   ├── datasource-hebrew-5-fixed.json
│   ├── datasource-hebrew-6.json     # Restaurant demo
│   ├── datasource-hebrew-6-fixed.json
│   ├── datasource-hebrew-7.json     # Logistics demo
│   ├── datasource-hebrew-7-fixed.json
│   └── test-datasource.json
│
├── scripts/                         # Utility scripts
│   ├── setup-dev-environment.ps1    # Dev environment setup
│   └── test-integration-workflow.ps1 # Integration testing
│
├── src/                             # Source code
│   ├── Frontend/                    # React TypeScript app
│   └── Services/                    # .NET microservices
│       ├── Shared/                  # Shared library
│       ├── DataSourceManagementService/
│       ├── SchedulingService/
│       ├── FilesReceiverService/
│       ├── ValidationService/
│       └── DataSourceChatService/
│
├── test-files/                      # Test data files
│   └── sample-banking-data.json
│
└── tests/                           # Test projects
    ├── Integration/
    ├── Load/
    └── Unit/
```

---

## Organized Folders

### docs/ - All Documentation
- **Root level**: Active project documentation
  - data_processing_prd.md - Product requirements
  - PROJECT_STANDARDS.md - Development standards
  - project-progress.md - Current progress
  - shrimp-rules.md - AI agent guidelines

- **docs/archive/**: Archived/historical documents
  - CLAUDE.md - Old conversation log
  - detailed-implementation-plan.md - Superseded plan

- **docs/mockups/**: UI design mockups
  - web_ui_mockups_hebrew.html - Hebrew UI mockup

- **docs/planning/**: ⭐ Implementation Planning (Current)
  - FINAL-CORRECTED-ARCHITECTURE.md - Primary technical reference
  - Complete frontend-backend implementation specifications
  - Metrics configuration extended plans
  - Comprehensive guides

### sample-data/ - Demo and Test Data
All Hebrew demo data files for testing:
- datasource-hebrew-1.json through datasource-hebrew-7.json
- Various fixed versions
- test-datasource.json

### scripts/ - Automation Scripts
- setup-dev-environment.ps1 - Development environment setup
- test-integration-workflow.ps1 - Integration testing automation

### src/ - Source Code
- Frontend/ - React 18 + TypeScript application
- Services/ - .NET 9.0 microservices
  - Each service in its own folder
  - Shared library for common code

### deploy/ - Deployment Configurations
- docker/ - Dockerfile templates
- kubernetes/ - K8s deployment files
- helm/ - Helm charts
- prometheus/ - Prometheus configurations
- grafana/ - Grafana dashboards

### test-files/ - Test Data Files
Sample files for testing file processing features

### tests/ - Test Projects
- Integration/ - Integration test projects
- Load/ - Load testing
- Unit/ - Unit tests

---

## Removed/Cleaned Up

### Deleted Files:
- ✅ fix_mongodb_types.js - Temporary MongoDB type fix script
- ✅ fix_boolean_types.js - Temporary Boolean serialization fix

### Moved to Archive:
- ✅ CLAUDE.md - Old conversation documentation
- ✅ detailed-implementation-plan.md - Superseded by new planning docs

### Moved to Mockups:
- ✅ web_ui_mockups_hebrew.html - UI mockup file

### Moved to Sample Data:
- ✅ All datasource-hebrew-*.json files
- ✅ test-datasource.json

---

## Clean Root Directory

The root directory now contains ONLY:
- Solution and build configuration files (.sln, global.json, Directory.Build.props, .editorconfig)
- Git configuration (.gitignore)
- Docker compose file (docker-compose.development.yml)
- Hidden folders (.augment, .clinerules, .github)
- Organized content folders (deploy, docs, sample-data, scripts, src, test-files, tests)

**Result:** Clean, professional project structure ready for team collaboration

---

## Quick Access

### For Developers:
- Start here: `docs/PROJECT_STANDARDS.md`
- Architecture: `docs/planning/FINAL-CORRECTED-ARCHITECTURE.md`
- Progress: `docs/project-progress.md`
- AI Rules: `docs/shrimp-rules.md`

### For Implementation:
- Main plan: `docs/planning/COMPREHENSIVE-IMPLEMENTATION-PLAN.md`
- Schema features: `docs/planning/frontend-backend-implementation-plan.md`
- Metrics features: `docs/planning/metrics-configuration-extended-plan.md`

### For Testing:
- Sample data: `sample-data/`
- Test scripts: `scripts/`
- Test files: `test-files/`

---

**Last Updated:** September 30, 2025  
**Status:** ✅ Organized and Clean
