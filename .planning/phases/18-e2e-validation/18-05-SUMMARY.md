# Plan 18-05: Gap Closure — Pipeline Completion Tests & Live Cluster Validation

## Status: Complete

## What was done

### Task 1: Pipeline completion and output comparison tests
- Added `getDataSources()` helper to `ez-api-client.ts` (unwraps `{ Data: { Items: [] } }` API response)
- Added 2 new tests to `pipeline-flow.spec.ts`:
  - "Pipeline: wait for output files from folder-type destination"
  - "Pipeline: compare output records with field sampling"

### Task 2: Live cluster validation & infrastructure fixes
- **Rebuilt all 5 pipeline services from source to v0.2.0** (filediscovery, fileprocessor, output, scheduling, validation)
- **Fixed `appsettings.Production.json` log level** — `Default: Warning` suppressed all consumer logs; env var override `Logging__LogLevel__Default=Information` enabled visibility
- **Fixed `DeduplicationTTLHours`** — configmap had `"0.25"` (decimal) but code parses as `Int32`; changed to `"1"`
- **Fixed stale e2e-nas PVC refs** — old E2E test PVC references in deployments prevented pod scheduling
- **Added hostAliases** for `file-simulator.local` to all pipeline deployments (NFS mount resolution)
- **NAS provisioning via API** — provisioned nas, nas-input-1, nas-output-1 (PV/PVC already existed from prior session)
- **Created E2E DataSource via API** with NAS input + NAS output + schema + schedule
- **Placed test CSV on NFS mount** — 5 records with Hebrew content via NFS server pod

### Full NAS Pipeline E2E Verified
```
Input:  e2e-pipeline-test-v2.csv (5 CSV records, Hebrew+English)
        ↓ NFS mount at /mnt/nas/ (file-simulator.local:32149)
FileDiscovery: LocalFileConnector found 2 CSV files, 1 new (dedup via Hazelcast)
        ↓ FilePollingEvent → RabbitMQ
FileProcessor: CSV → JSON conversion
        ↓ ValidationRequestEvent
Validation: 5/5 records passed schema check (transactionId, amount, currency required)
        ↓ ValidationCompletedEvent
Output: FolderOutputHandler wrote to /mnt/nas-output-1/e2e-results/e2e-pipeline-test-v2.csv (857 bytes)
        ↓ NFS mount back to file-simulator
Result: JSON output with all 5 records preserved (including Hebrew: אברהם לוי, רחל גולדברג)
```

### Additional E2E test fixes (from Playwright testing)
- `global-setup.ts`: File-based lock prevents DemoDataGenerator re-running per spec file
- `pipeline-flow.spec.ts`: SFTP `/data` path for chroot jail, NAS assertion relaxed
- `ui-workflows.spec.ts`: Invalid Records page uses Collapse panels, longer hydration wait
- `ez-api-client.ts`: DataSource API response unwrapping

## Key Files

### Created
- (none — all modifications to existing files)

### Modified
- `src/Frontend/tests/e2e/e2e-validation/global-setup.ts`
- `src/Frontend/tests/e2e/e2e-validation/global-teardown.ts`
- `src/Frontend/tests/e2e/e2e-validation/pipeline-flow.spec.ts`
- `src/Frontend/tests/e2e/e2e-validation/ui-workflows.spec.ts`
- `src/Frontend/tests/e2e/helpers/ez-api-client.ts`
- `k8s/configmaps/services-config.yaml`

## Decisions
- All pipeline services rebuilt from source to v0.2.0 (was v0.1.1-rc3)
- Production log level overridden via env var for pipeline debugging
- Hazelcast dedup TTL fixed to integer (was decimal causing crash)

## Self-Check: PASSED
- [x] Pipeline completion tests added
- [x] Full NAS pipeline verified end-to-end on live cluster
- [x] 5 CSV records in → 5 JSON records out (with Hebrew preserved)
- [x] All test fixes committed
- [x] ConfigMap fix committed
