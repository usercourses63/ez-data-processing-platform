# Requirements: EZ Data Processing Platform

**Defined:** 2026-03-21
**Core Value:** Files flow reliably from any source through validation to any destination, with complete visibility and traceability

## v0.4.0 Requirements

Requirements for Datasource Productivity Features milestone. Each maps to roadmap phases.

### Clone Datasource

- [x] **CLONE-01**: User can clone a datasource from the list page actions menu
- [x] **CLONE-02**: User can clone a datasource from the details page header
- [x] **CLONE-03**: Cloned datasource pre-fills all form fields (name prefixed with "Copy of", schedule disabled, output destinations get new IDs)

### Import from File

- [x] **IMPORT-01**: User can upload a sample data file (CSV, JSON, XML) to auto-fill datasource form fields
- [x] **IMPORT-02**: System infers JSON Schema 2020-12 from file content with type detection (integer, number, boolean, date, string)
- [x] **IMPORT-03**: CSV files without headers generate synthetic field names (field_1, field_2, ... field_N)
- [x] **IMPORT-04**: System applies smart constraints via schemaAutoSuggest (email format, phone patterns, date formats, etc.)
- [ ] **IMPORT-05**: User can preview parsed data in a table and review/edit inferred schema in Monaco Editor before applying

### Completeness Checklist

- [x] **CHECK-01**: Create form shows real-time completeness percentage and per-tab status
- [x] **CHECK-02**: Edit form shows real-time completeness percentage and per-tab status
- [x] **CHECK-03**: Clicking an incomplete tab item navigates to that tab
- [x] **CHECK-04**: Required vs recommended fields distinguished with color-coded indicators (green/yellow/red/gray)

### Documentation & Release

- [ ] **DOC-09**: Hebrew user guide refactored with detailed coverage of all v0.4.0 features (clone, import, checklist)
- [ ] **DOC-10**: Docusaurus documentation updated for v0.4.0 (changelog, component docs, admin guide)
- [ ] **REL-08**: All service images built from source with v0.4.0 tag
- [ ] **REL-09**: Deployment package assembled (deployment-v0.4.0-{timestamp}/) with Helm chart, images, install scripts
- [ ] **REL-10**: Fresh install from deployment package using install.ps1 succeeds on clean cluster
- [ ] **REL-11**: Sanity tests pass against fresh install including documentation correctness verification

### Clone — Metrics (deferred within v0.4.0)

- [ ] **CLONE-04**: Clone also duplicates associated metric configurations (with new IDs and updated datasource reference)

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Datasource Management
- **DS-FUTURE-01**: Export datasource configuration as JSON file
- **DS-FUTURE-02**: Bulk clone multiple datasources
- **DS-FUTURE-03**: Excel file import support (in addition to CSV/JSON/XML)
- **DS-FUTURE-04**: Datasource configuration templates (save/load presets)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Backend API changes | All 3 features are frontend-only; backend already has all needed endpoints |
| Datasource diff/compare | Useful but separate feature, not part of productivity focus |
| Auto-save / draft mode | Complexity vs value -- users can use clone as workaround |
| File upload to server | Import is for schema inference only, not file ingestion |
| OpenTelemetry MassTransit trace propagation | Deferred from v0.3, still not in scope |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLONE-01 | Phase 25 | Complete |
| CLONE-02 | Phase 25 | Complete |
| CLONE-03 | Phase 25 | Complete |
| IMPORT-01 | Phase 27 | Complete |
| IMPORT-02 | Phase 27 | Complete |
| IMPORT-03 | Phase 27 | Complete |
| IMPORT-04 | Phase 27 | Complete |
| IMPORT-05 | Phase 27 | Pending |
| CHECK-01 | Phase 26 | Complete |
| CHECK-02 | Phase 26 | Complete |
| CHECK-03 | Phase 26 | Complete |
| CHECK-04 | Phase 26 | Complete |
| CLONE-04 | Phase 28 | Pending |
| DOC-09 | Phase 28 | Pending |
| DOC-10 | Phase 28 | Pending |
| REL-08 | Phase 28 | Pending |
| REL-09 | Phase 28 | Pending |
| REL-10 | Phase 28 | Pending |
| REL-11 | Phase 28 | Pending |

**Coverage:**
- v0.4.0 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation (traceability updated)*
