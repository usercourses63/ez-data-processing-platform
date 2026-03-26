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
- [x] **IMPORT-05**: User can preview parsed data in a table and review/edit inferred schema in Monaco Editor before applying

### Completeness Checklist

- [x] **CHECK-01**: Create form shows real-time completeness percentage and per-tab status
- [x] **CHECK-02**: Edit form shows real-time completeness percentage and per-tab status
- [x] **CHECK-03**: Clicking an incomplete tab item navigates to that tab
- [x] **CHECK-04**: Required vs recommended fields distinguished with color-coded indicators (green/yellow/red/gray)

### Documentation & Release

- [x] **DOC-09**: Hebrew user guide refactored with detailed coverage of all v0.4.0 features (clone, import, checklist)
- [x] **DOC-10**: Docusaurus documentation updated for v0.4.0 (changelog, component docs, admin guide)
- [x] **REL-08**: All service images built from source with v0.4.0 tag
- [x] **REL-09**: Deployment package assembled (deployment-v0.4.0-{timestamp}/) with Helm chart, images, install scripts
- [ ] **REL-10**: Fresh install from deployment package using install.ps1 succeeds on clean cluster
- [ ] **REL-11**: Sanity tests pass against fresh install including documentation correctness verification

### Clone — Metrics (deferred within v0.4.0)

- [ ] **CLONE-04**: Clone also duplicates associated metric configurations (with new IDs and updated datasource reference)

### Invalid Records Auto-Revalidation

- [x] **REVAL-01**: SchemaUpdatedEvent published when datasource JsonSchema is modified
- [x] **REVAL-02**: InvalidRecordsService consumes SchemaUpdatedEvent and queries affected non-ignored invalid records
- [x] **REVAL-03**: Bulk ValidationRequestEvent published for all affected records with IsReprocess=true
- [ ] **REVAL-04**: Records that pass new schema deleted from invalid records and routed to OutputService
- [ ] **REVAL-05**: Records that still fail updated with new error messages from new schema
- [x] **REVAL-06**: Schema versioning: SchemaVersion auto-increments, ValidatedWithSchemaVersion tracks original
- [x] **REVAL-07**: Rate limiting: batches of 100 with 1-second delays for >1000 records
- [ ] **REVAL-08**: Frontend "Revalidate All" button in 2 locations (invalid records page header, schema tab)
- [ ] **REVAL-09**: SignalR notification shows "X of Y records resolved by schema change"
- [ ] **REVAL-10**: Playwright E2E test covers revalidation workflow
- [ ] **REVAL-11**: Hebrew user guide chapter with Mermaid flow diagram and step-by-step instructions
- [ ] **REVAL-12**: Docusaurus docs updated: changelog, release notes, admin guide
- [ ] **REVAL-13**: Visual indicator on revalidated records (schema version tag)
- [ ] **REVAL-14**: Global invalid records TTL default in ConfigMap (4 days)
- [ ] **REVAL-15**: Per-datasource TTL override in basic info tab
- [ ] **REVAL-16**: Daily Quartz.NET purge job for expired invalid records
- [ ] **REVAL-17**: Default TTL period: 4 days
- [ ] **REVAL-18**: YAML schema download button in schema editor
- [ ] **REVAL-19**: js-yaml library for frontend JSON-to-YAML conversion
- [ ] **REVAL-20**: YAML file naming matches JSON but with .yaml extension
- [ ] **REVAL-21**: Fix broken schema editor link in correction dialog
- [ ] **REVAL-22**: Schema editor link navigates to /datasources/{id}/edit with Schema tab active
- [ ] **REVAL-23**: Hebrew user guide follows per-chapter template (same as clone/import/completeness)
- [ ] **REVAL-24**: TTL behavior documented in create-datasource chapter
- [ ] **REVAL-25**: Revalidate All button documented in invalid-records chapter
- [ ] **REVAL-26**: Changelog and release notes updated for revalidation pipeline

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
| Auto-revalidation analytics dashboard | Track which schema changes resolved most records (deferred) |
| Webhook notification on revalidation completion | In addition to SignalR (deferred) |
| Schema diff viewer | Show what changed between schema versions (deferred) |

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
| IMPORT-05 | Phase 27 | Complete |
| CHECK-01 | Phase 26 | Complete |
| CHECK-02 | Phase 26 | Complete |
| CHECK-03 | Phase 26 | Complete |
| CHECK-04 | Phase 26 | Complete |
| CLONE-04 | Phase 28 | Pending |
| DOC-09 | Phase 28 | Complete |
| DOC-10 | Phase 28 | Complete |
| REL-08 | Phase 28 | Complete |
| REL-09 | Phase 28 | Complete |
| REL-10 | Phase 28 | Pending |
| REL-11 | Phase 28 | Pending |
| REVAL-01 | Phase 29 | Complete |
| REVAL-02 | Phase 29 | Complete |
| REVAL-03 | Phase 29 | Complete |
| REVAL-04 | Phase 29 | Pending |
| REVAL-05 | Phase 29 | Pending |
| REVAL-06 | Phase 29 | Complete |
| REVAL-07 | Phase 29 | Complete |
| REVAL-08 | Phase 29 | Pending |
| REVAL-09 | Phase 29 | Pending |
| REVAL-10 | Phase 29 | Pending |
| REVAL-11 | Phase 29 | Pending |
| REVAL-12 | Phase 29 | Pending |
| REVAL-13 | Phase 29 | Pending |
| REVAL-14 | Phase 29 | Pending |
| REVAL-15 | Phase 29 | Pending |
| REVAL-16 | Phase 29 | Pending |
| REVAL-17 | Phase 29 | Pending |
| REVAL-18 | Phase 29 | Pending |
| REVAL-19 | Phase 29 | Pending |
| REVAL-20 | Phase 29 | Pending |
| REVAL-21 | Phase 29 | Pending |
| REVAL-22 | Phase 29 | Pending |
| REVAL-23 | Phase 29 | Pending |
| REVAL-24 | Phase 29 | Pending |
| REVAL-25 | Phase 29 | Pending |
| REVAL-26 | Phase 29 | Pending |

**Coverage:**
- v0.4.0 requirements: 45 total
- Mapped to phases: 45
- Unmapped: 0

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-26 after Phase 29 planning*
