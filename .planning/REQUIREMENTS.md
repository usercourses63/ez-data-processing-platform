# Requirements: EZ Platform v0.3.0

**Defined:** 2026-03-20
**Core Value:** Files flow reliably from any source through validation to any destination, with complete visibility and traceability — no data loss, no silent failures, every record accounted for.

## v0.3 Requirements

Requirements for v0.3.0 NAS UX + Monitoring + Release. Most features already implemented — this milestone packages and releases them.

### NAS UX & SignalR (implemented)

- [x] **NAS-12**: SignalR EntityChanged broadcasts on Servers controller (create/update/delete/toggle)
- [x] **NAS-13**: SignalR EntityChanged broadcasts on Categories controller (create/update/delete/reorder)
- [x] **NAS-14**: NAS delete auto-deprovisions K8s PV/PVC before soft-delete
- [x] **NAS-15**: NAS status tags use i18n keys (connected/disconnected)
- [x] **NAS-16**: NAS Role enum accepts string values from frontend (JsonStringEnumConverter)

### Data Pipeline Fixes (implemented)

- [x] **PIPE-06**: FileServerId extracted from ConfigurationSettings on datasource create/update
- [x] **PIPE-07**: NasDeviceId/NasSubPath extracted from ConfigurationSettings
- [x] **PIPE-08**: FTP connector parses ftp:// URLs for host/port instead of using as hostname
- [x] **PIPE-09**: Server credentials auto-populated from AdminServer.TypeSpecificConfig
- [x] **PIPE-10**: ConnectionString optional for NAS datasources

### Monitoring Fixes (implemented)

- [x] **MON-15**: Device Health tab loads via HTTP polling (not blocked by SignalR)
- [x] **MON-16**: SignalR mappers handle both camelCase and PascalCase
- [x] **MON-17**: RabbitMQ queue monitoring replaces Kafka
- [x] **MON-18**: Pipeline flow service IDs match K8s deployment names
- [x] **MON-19**: Traces tab queries all pipeline services with relative span timing

### Release Package

- [x] **REL-03**: Frontend version updated to v0.3.0 in footer
- [x] **REL-04**: Docusaurus documentation updated for v0.3.0 features
- [ ] **REL-05**: All service images built from source with v0.3.0 tag
- [ ] **REL-06**: Deployment package assembled (deployment-v0.3.0-{timestamp}/)
- [x] **REL-07**: Sanity tests updated and pass against deployed v0.3.0

## Out of Scope

| Feature | Reason |
|---------|--------|
| OpenTelemetry MassTransit trace propagation | Requires changes to all pipeline services, deferred to v0.4 |
| NAS E2E with unfs3 (NFSv3) servers | Only erichough/nfs-server (NFSv4) works cross-cluster |
| Multi-destination NAS output test | Cross-cluster NFS mount complexities, tested with FTP |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAS-12 | Pre-phase (already committed) | Complete |
| NAS-13 | Pre-phase (already committed) | Complete |
| NAS-14 | Pre-phase (already committed) | Complete |
| NAS-15 | Pre-phase (already committed) | Complete |
| NAS-16 | Pre-phase (already committed) | Complete |
| PIPE-06 | Pre-phase (already committed) | Complete |
| PIPE-07 | Pre-phase (already committed) | Complete |
| PIPE-08 | Pre-phase (already committed) | Complete |
| PIPE-09 | Pre-phase (already committed) | Complete |
| PIPE-10 | Pre-phase (already committed) | Complete |
| MON-15 | Pre-phase (already committed) | Complete |
| MON-16 | Pre-phase (already committed) | Complete |
| MON-17 | Pre-phase (already committed) | Complete |
| MON-18 | Pre-phase (already committed) | Complete |
| MON-19 | Pre-phase (already committed) | Complete |
| REL-03 | Phase 24 | Complete |
| REL-04 | Phase 24 | Complete |
| REL-05 | Phase 24 | Pending |
| REL-06 | Phase 24 | Pending |
| REL-07 | Phase 24 | Complete |

**Coverage:**
- v0.3 requirements: 20 total
- Already complete: 15
- Pending (Phase 24): 5
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
