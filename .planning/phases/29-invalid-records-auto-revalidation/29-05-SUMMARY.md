---
phase: 29-invalid-records-auto-revalidation
plan: "05"
subsystem: frontend
tags: [signalr, notifications, revalidation, ttl, schema-version]
dependency_graph:
  requires: [29-03, 29-04]
  provides: [revalidation-notifications, ttl-field, schema-version-tags]
  affects: [InvalidRecordsManagement, BasicInfoTab, App.tsx]
tech_stack:
  added: []
  patterns: [signalr-hub-hook, custom-event-dispatch, app-useapp-messages]
key_files:
  created:
    - src/Frontend/src/hooks/useRevalidationNotifications.ts
  modified:
    - src/Frontend/src/App.tsx
    - src/Frontend/src/pages/invalid-records/InvalidRecordsManagement.tsx
    - src/Frontend/src/services/invalidrecords-api-client.ts
    - src/Frontend/src/components/datasource/tabs/BasicInfoTab.tsx
    - src/Frontend/src/types/entities.ts
    - src/Frontend/src/i18n/locales/he.json
    - src/Frontend/src/i18n/locales/en.json
decisions:
  - Used App.useApp() for message API instead of static message import (per CLAUDE.md)
  - Placed RevalidationNotificationProvider inside AntApp wrapper so useApp() context is available
  - TTL field uses PascalCase form name (InvalidRecordsTtlDays) matching backend property convention
  - Schema version and revalidated tags placed next to record title in horizontal Space layout
metrics:
  duration: 216s
  completed: "2026-03-26T12:08:12Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 8
---

# Phase 29 Plan 05: Frontend Notifications & TTL Field Summary

SignalR revalidation notifications with toast on completion, auto-refresh of invalid records stats, schema version tags on records, and per-datasource TTL field in BasicInfoTab.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create useRevalidationNotifications hook and integrate | 8364cec | useRevalidationNotifications.ts, App.tsx, InvalidRecordsManagement.tsx |
| 2 | Add per-datasource TTL field to BasicInfoTab | ca57a91 | BasicInfoTab.tsx, entities.ts, he.json, en.json |

## Implementation Details

### Task 1: SignalR Revalidation Notifications
- Created `useRevalidationNotifications` hook that connects to `http://localhost:5007/hubs/invalid-records`
- Listens for `RevalidationCompleted` events and shows toast notification for 10 seconds (per D-05)
- Uses `App.useApp()` message API per CLAUDE.md (not static `message.success`)
- Selects Hebrew or English message based on current i18n language
- Dispatches `revalidation-completed` CustomEvent for page-level data refresh
- Forwards `EntityChanged` events for InvalidRecord entities to existing entity-changed system
- `InvalidRecordsManagement.tsx` listens for `revalidation-completed` and refreshes records, stats, and filtered stats
- Added `validatedWithSchemaVersion` and `isRevalidated` fields to InvalidRecord interface
- Schema version tag (blue) and revalidated tag (green) displayed on record cards

### Task 2: Per-Datasource TTL Field
- Added `InvalidRecordsTtlDays` InputNumber field to BasicInfoTab (min 1, max 365, placeholder 4)
- Placed in new row below retentionDays field, following same UI pattern
- Uses existing `revalidation.ttlDays` and `revalidation.ttlDaysTooltip` i18n keys from plan 29-04
- Added `common.days` i18n key ("ימים" / "days") for InputNumber addonAfter
- Added `invalidRecordsTtlDays` to DataSource TypeScript interface

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Used App.useApp() instead of static message**
- **Found during:** Task 1
- **Issue:** Plan specified `import { message } from 'antd'` but CLAUDE.md mandates App.useApp() hook
- **Fix:** Used `App.useApp()` to get message API inside the hook
- **Files modified:** src/Frontend/src/hooks/useRevalidationNotifications.ts

**2. [Rule 2 - Missing i18n key] Added common.days key**
- **Found during:** Task 2
- **Issue:** InputNumber `addonAfter` needed "days" translation key that didn't exist
- **Fix:** Added `common.days` to both he.json and en.json
- **Files modified:** he.json, en.json

## Known Stubs

None - all data sources are wired to backend SignalR events and form fields.

## Verification

- TypeScript compilation: PASSED (no errors)
- All acceptance criteria: PASSED

## Self-Check: PASSED

All 6 key files verified present on disk. Both commits (8364cec, ca57a91) confirmed in git log.
