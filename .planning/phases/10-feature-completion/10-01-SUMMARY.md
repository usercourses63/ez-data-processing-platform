---
phase: 10-feature-completion
plan: 01
subsystem: frontend-backend
tags: [nas, datasource, archive, integration]
status: complete
completed: 2026-02-03

dependency-graph:
  requires: [02-05, 02-06]
  provides: [nas-datasource-integration, archive-fileprocessor-wiring]
  affects: [10-02, 10-03]

tech-stack:
  added: []
  patterns: [nas-device-dropdown, form-field-cascading, archive-service-injection]

key-files:
  created: []
  modified:
    - src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx
    - src/Frontend/src/i18n/locales/he.json
    - src/Frontend/src/i18n/locales/en.json

decisions:
  - id: nas-replaces-nfs
    summary: NAS replaces NFS in protocol dropdown - NFS is internal implementation detail
    rationale: User mental model should be "select NAS device" not "configure NFS protocol"
  - id: unmounted-disabled
    summary: Unmounted NAS devices appear disabled with indicator
    rationale: Users can see available devices but cannot select unmounted ones
  - id: archive-already-integrated
    summary: Archive extraction was already implemented in FileProcessor
    rationale: Task 2 verified existing implementation, no code changes needed

metrics:
  duration: 8 min
  tasks-completed: 2/2
  files-modified: 3
---

# Phase 10 Plan 01: Datasource-NAS Integration Summary

**One-liner:** NAS protocol option in ConnectionTab with device dropdown and mount status indicators

## What Was Built

### Task 1: NAS Protocol Option in ConnectionTab

1. **Protocol Dropdown Updated**
   - Replaced `NFS - Network File System` with `NAS - Network Attached Storage`
   - Added `HddOutlined` icon for NAS protocol
   - Updated `protocolToServerType` mapping: `'NAS': 'nas'`

2. **NAS Device Dropdown**
   - New useQuery hook fetches NAS devices when NAS protocol selected
   - Filters devices by role (Input or Both)
   - Shows mount status with color indicators (green=mounted, orange=unmounted)
   - Unmounted devices disabled with "Not mounted" tag
   - Shows device host:port in dropdown options

3. **NAS-Specific Form Fields**
   - `nasSubPath` field for path within NFS export
   - Displays export path as addon prefix
   - Shows computed full mount path in info alert
   - File pattern field for NAS protocol

4. **Form State Management**
   - Clears NAS fields when switching away from NAS protocol
   - Clears server fields when switching to NAS protocol
   - Archive settings section works with NAS (file-based protocol)

5. **Translations Added**
   - Hebrew: `datasources.protocols.nas`, `datasources.fields.nasDevice`, `nasNotMounted`, etc.
   - English: Matching translations for all new keys

### Task 2: Archive Extraction Through FileProcessor

**Verification Result:** Already implemented - no code changes needed.

The existing implementation in `FileDiscoveredEventConsumer.cs` already:
- Injects `IArchiveService` and `IArchiveCacheService`
- Detects archive files via `IsFromArchive` message property
- Extracts files using `ExtractFileFromArchiveAsync` method
- Caches archives in Hazelcast for efficient multi-file extraction
- Respects `ArchiveSecuritySettings` from datasource configuration

Connectors remain archive-agnostic (verified via grep - no `ExtractMatchingFilesAsync` calls in connectors).

## Verification Results

```bash
# Frontend build
npm run build
# Result: Build succeeded (22.10s)

# Backend build
dotnet build src/Services/FileProcessorService
# Result: Build succeeded, 0 errors, 0 warnings

# Connector archive-agnostic check
grep -r "ExtractMatchingFilesAsync|ExtractFileAsync" src/Services/Shared/Connectors/
# Result: No matches found (connectors don't extract archives)

# Archive service integration check
grep -r "IArchiveService" src/Services/FileProcessorService/
# Result: Properly injected in Program.cs and FileDiscoveredEventConsumer.cs
```

## Key Decisions Made

| Decision | Rationale |
|----------|-----------|
| NAS replaces NFS in dropdown | NFS is implementation detail, user selects "NAS device" |
| Unmounted devices visible but disabled | Users can see all configured devices, understand what's available |
| Archive integration verified, not modified | Existing implementation complete and correct |

## Files Modified

| File | Changes |
|------|---------|
| `ConnectionTab.tsx` | +196 lines: NAS device query, dropdown, form fields, mount status |
| `he.json` | +26 lines: Hebrew translations for NAS UI strings |
| `en.json` | +21 lines: English translations for NAS UI strings |

## Commits

- `e2da2bf`: feat(10-01): add NAS protocol option to ConnectionTab

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

### Verified Existing Implementation

**Task 2 (Archive extraction):** The plan specified wiring archive extraction through FileProcessor, but verification showed this was already completely implemented in the existing codebase:

- `IArchiveService` registered in `Program.cs` line 89
- `IArchiveCacheService` registered in `Program.cs` line 92
- Both services injected into `FileDiscoveredEventConsumer` (lines 27-28, 38-39)
- Full extraction flow implemented in `ExtractFileFromArchiveAsync` (lines 320-413)

This was likely implemented during Phase 2 (NAS/NFS Architecture) as part of the archive handling infrastructure.

## Next Steps

- Plan 10-02: AdminServer E2E tests
- Plan 10-03: Archive E2E validation
