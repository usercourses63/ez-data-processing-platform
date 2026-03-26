# Phase 29: Invalid Records Auto-Revalidation - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

When a datasource schema is updated, automatically revalidate all existing invalid records against the new schema. Records that now pass are reprocessed and routed to output. Includes: SchemaUpdatedEvent, InvalidRecordsService consumer, schema versioning, bulk revalidation with rate limiting, frontend "Revalidate All" button (two locations), SignalR notifications, TTL for invalid records, YAML schema download, fix broken schema editor link in correction dialog, and full documentation (Hebrew user guide chapter + docs updates).

</domain>

<decisions>
## Implementation Decisions

### Auto-Revalidation Trigger
- **D-01:** Revalidation is automatic and silent -- when user saves a modified schema, revalidation kicks off immediately in the background with no confirmation dialog
- **D-02:** For large datasets (>1000 records), batch with rate limiting: 100 records per batch, 1-second delay between batches
- **D-03:** SchemaUpdatedEvent published via MassTransit/Kafka when datasource JsonSchema is modified
- **D-04:** InvalidRecordsService consumes SchemaUpdatedEvent, queries affected non-ignored records, publishes bulk ValidationRequestEvents

### Notification UX
- **D-05:** Toast notification via SignalR: "X of Y records resolved by schema change" (disappears after ~10s)
- **D-06:** Invalid records page statistics dashboard auto-updates in real-time via SignalR as records are resolved (existing stats cards)
- **D-07:** Both mechanisms together -- toast for immediate feedback, stats for persistent view

### "Revalidate All" Button Placement
- **D-08:** Two locations: (1) Invalid records page header next to "מחק הכל" and "יצא JSON" -- respects current filters, (2) Schema tab in datasource edit -- scoped to that datasource, visible only when invalid records exist
- **D-09:** Both trigger same backend endpoint. Confirmation popover showing record count before execution
- **D-10:** This is a recovery/admin tool -- the auto-trigger on schema change handles 95% of cases. Button covers edge cases: records arriving after schema change, transient failures during auto-revalidation

### Records That Still Fail
- **D-11:** Error messages updated to reflect the NEW schema's validation errors (errors may change type)
- **D-12:** Schema version tracking: DataProcessingDataSource.SchemaVersion auto-increments on schema change, DataProcessingInvalidRecord.ValidatedWithSchemaVersion tracks which version the record was validated against
- **D-13:** Visual indicator on re-validated records: small tag showing schema version or "revalidated" label

### TTL for Invalid Records
- **D-14:** Global default configured in ConfigMap: `invalid-records-ttl-days: 4` (4 days)
- **D-15:** Per-datasource override in basic info tab, next to existing "תקופת שמירה" field: new field "שמירת רשומות שגויות" (invalid records retention)
- **D-16:** Hard delete via background Quartz.NET job running daily, purges expired records
- **D-17:** Default period: 4 days (short to prevent DB explosion)

### YAML Schema Download
- **D-18:** Frontend-only: add "Download YAML" button next to existing "Download JSON" in schema editor
- **D-19:** Use `js-yaml` library for JSON→YAML conversion in browser
- **D-20:** File naming: same as JSON but with `.yaml` extension

### Bug Fix: Schema Editor Link in Correction Dialog
- **D-21:** Fix the broken link in the invalid records correction dialog that should navigate to `/datasources/{dataSourceId}/edit` and auto-switch to the Schema tab
- **D-22:** Currently the link exists but does not work -- needs correct route + tab activation

### Documentation
- **D-23:** Hebrew user guide chapter for auto-revalidation (same template as clone/import/completeness chapters) with screenshots, Mermaid flow diagram, step-by-step instructions
- **D-24:** Document TTL behavior in create-datasource chapter and troubleshooting FAQ
- **D-25:** Document Revalidate All button in invalid-records chapter
- **D-26:** Update changelog, release notes, admin guide for revalidation pipeline

### Claude's Discretion
- Event naming and field structure for SchemaUpdatedEvent (follow existing DataSourceUpdatedEvent pattern)
- Quartz.NET job schedule for TTL cleanup (daily recommended)
- Exact placement of YAML download button relative to JSON button
- Schema version number format (integer auto-increment recommended)
- Whether to use existing CorrectionService.PublishRevalidationRequest() or create new service

</decisions>

<specifics>
## Specific Ideas

- CorrectionService already has IPublishEndpoint dependency and a PublishRevalidationRequest() method stub
- Bulk reprocess API already exists: POST /api/v1/invalid-records/bulk/reprocess
- SignalR EntityChanged pattern already established on DataSourceController, ServersController, etc.
- Existing "תקופת שמירה" field in basic tab is the UI pattern to follow for invalid records TTL
- Schema tab in edit form uses Monaco editor with existing download JSON functionality
- Invalid records page already has real-time SignalR updates for record CRUD

</specifics>

<canonical_refs>
## Canonical References

### Event System
- `src/Services/Shared/Messages/` — All existing event contracts (DataSourceUpdatedEvent pattern)
- `src/Services/Shared/Consumers/` — Base consumer class

### Invalid Records Service
- `src/Services/InvalidRecordsService/Services/CorrectionService.cs` — Has PublishRevalidationRequest() stub
- `src/Services/InvalidRecordsService/Controllers/InvalidRecordsController.cs` — Existing bulk reprocess endpoints

### Schema Management
- `src/Services/DataSourceManagementService/Controllers/SchemaController.cs` — Schema update endpoint (line ~183)
- `src/Services/DataSourceManagementService/Controllers/DataSourceController.cs` — SignalR broadcast pattern

### Frontend
- `src/Frontend/src/pages/invalid-records/InvalidRecordsManagement.tsx` — Invalid records page
- `src/Frontend/src/components/invalid-records/EditRecordModal.tsx` — Correction dialog (broken link fix)
- `src/Frontend/src/pages/datasources/DataSourceEditEnhanced.tsx` — Edit form with schema tab

### Infrastructure
- `k8s/configmaps/services-config.yaml` — ConfigMap for global settings
- `src/Services/Shared/Configuration/` — Service configuration patterns

</canonical_refs>

<deferred>
## Deferred Ideas

- Auto-revalidation analytics dashboard (which schema changes resolved the most records)
- Webhook notification on revalidation completion (in addition to SignalR)
- Schema diff viewer (show what changed between versions)

</deferred>

---

*Phase: 29-invalid-records-auto-revalidation*
*Context gathered: 2026-03-26*
