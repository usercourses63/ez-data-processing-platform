# v0.3.0 Release Validation Design

**Date:** 2026-03-20
**Status:** Approved
**Purpose:** Validate input/output tab server selections and end-to-end pipeline before v0.3.0 release

---

## Part 1: Input/Output Tab Server Selection Verification

### Goal
Verify that datasource edit form dropdowns only show eligible, working servers and NAS devices.

### Test Matrix

| Tab | Protocol | Expected Filter | Validation |
|-----|----------|----------------|------------|
| Connection (Input) | FTP | `Direction=Input, IsActive=true, ServerType=ftp` | Compare dropdown options vs filtered API response |
| Connection (Input) | SFTP | `Direction=Input, IsActive=true, ServerType=sftp` | Same |
| Connection (Input) | NAS | `Role=Input\|Both`, unmounted disabled | Verify disabled state on unprovisioned devices |
| Output destination | FTP | `Direction=Output, IsActive=true, ServerType=ftp` | Compare dropdown options vs filtered API response |
| Output destination | NAS | `Role=Output\|Both\|Backup`, unmounted disabled | Verify disabled state |

### Implementation
- Playwright headed tests
- For each protocol: open dropdown, collect visible option texts, compare against API data with same filter
- Log any mismatches as test failures
- Verify unmounted NAS devices show disabled state + "לא מחובר" tag

### API Endpoints Used
- `GET /api/v1/servers/input` — input servers
- `GET /api/v1/servers/output` — output servers
- `GET /api/v1/nasdevices` — all NAS devices
- `GET /api/v1/nasdevices/by-role/{role}` — role-filtered NAS devices

---

## Part 2: FTP End-to-End Pipeline (Quick Baseline)

### Goal
Verify the full pipeline works with FTP protocol (no NAS mount dependencies).

### Prerequisites
- File-simulator running (port 30500 API, port 30021 FTP)
- All pipeline services running (scheduling, filediscovery, fileprocessor, validation, output)
- RabbitMQ running (port 5672 AMQP, port 15672 management)

### Test Flow

1. **Upload test file**
   - Use file-simulator FTP at `file-simulator.local:30021`
   - Upload `test-data/corvus-test-100.csv` to `/data/e2e-ftp-test/`

2. **Create datasource via frontend**
   - Name: `e2e-ftp-pipeline`
   - Protocol: FTP
   - Server: existing FTP input server pointing to file-simulator
   - File path: `/data/e2e-ftp-test/`
   - File pattern: `*.csv`

3. **Configure schema**
   - JSON Schema matching CSV columns: TransactionId, CustomerName, Amount, Date, Status, Category, PaymentMethod

4. **Add output destination**
   - Type: FTP
   - Server: FTP output server
   - Output path: `/data/e2e-ftp-output/`

5. **Trigger pipeline**
   - Create schedule via Scheduling API
   - Trigger manual poll
   - Or publish `FilePollingEvent` to RabbitMQ directly

6. **Verify pipeline completion**
   - FileDiscovery: file detected (check logs)
   - FileProcessor: file parsed (check logs)
   - Validation: records validated (check Prometheus `business_records_processed_total`)
   - Output: file written to FTP output path

### Success Criteria
- Output file exists on FTP output server
- Prometheus counter `business_records_processed_total` incremented by ~100
- RabbitMQ queues show message flow (FilePollingEvent → FileDiscoveredEvent → ValidationRequest → ValidationCompleted)
- No error records (or expected count if schema mismatches)

---

## Part 3: NAS End-to-End Pipeline (Production Path)

### Goal
Verify full pipeline with NAS/NFS input and multi-destination output (NAS + FTP).

### Pre-flight: NAS Volume Provisioning

**Step 1: Verify clean deployments**
```bash
# Ensure no stale NAS volumes on pipeline deployments
for dep in filediscovery fileprocessor output; do
  kubectl get deployment $dep -n ez-platform -o jsonpath='{.spec.template.spec.volumes[*].name}'
done
# If any nas-* volumes exist, patch them out first
```

**Step 2: Provision input NAS**
- Device: `nas-input-1` (file-simulator.local:32150, Role=Input)
- API: `POST /api/v1/nasdevices/{id}/provision`
- Auto-mounts to: filediscovery, fileprocessor, datasource-management
- Wait for rollout: `kubectl rollout status deployment/filediscovery -n ez-platform`

**Step 3: Provision output NAS**
- Device: `nfs-output-data` (file-simulator.local:32597, Role=Output)
- API: `POST /api/v1/nasdevices/{id}/provision`
- Auto-mounts to: output, datasource-management
- Wait for rollout: `kubectl rollout status deployment/output -n ez-platform`

**Step 4: Verify all pods healthy**
```bash
kubectl get pods -n ez-platform -l 'app in (filediscovery,fileprocessor,output)'
# All must be 1/1 Running
```

**Abort condition:** If any pod hangs in ContainerCreating for >2 minutes, immediately patch out the volume and skip NAS test.

### Test Flow

1. **Upload test file to input NAS**
   - Write CSV to `nas-input-1` NFS export via file-simulator
   - Path: `/e2e-nas-test/test-data.csv`

2. **Create datasource via frontend**
   - Name: `e2e-nas-pipeline`
   - Protocol: NAS
   - Device: `nas-input-1`
   - Sub-path: `/e2e-nas-test/`
   - File pattern: `*.csv`

3. **Configure schema**
   - Same JSON Schema as FTP test

4. **Add 2 output destinations**
   - Destination 1: NAS → `nfs-output-data`, sub-path `/e2e-nas-output/`
   - Destination 2: FTP → FTP output server, path `/data/e2e-nas-ftp-output/`

5. **Trigger pipeline**
   - Same as FTP test (schedule + trigger or direct RabbitMQ publish)

6. **Verify pipeline completion**
   - Output file on NAS: check via file-simulator or kubectl exec
   - Output file on FTP: check via file-simulator
   - Prometheus metrics incremented
   - Jaeger trace shows multi-service spans

### Cleanup
1. Deprovision `nas-input-1`: `DELETE /api/v1/nasdevices/{id}/provision`
2. Deprovision `nfs-output-data`: `DELETE /api/v1/nasdevices/{id}/provision`
3. Delete test datasources
4. Verify pipeline deployment pods still healthy after deprovision

### Success Criteria
- Output file exists on both NAS and FTP destinations
- Prometheus counters incremented
- No CrashLoopBackOff on any pipeline pod
- Clean deprovision (no orphaned PV/PVC)

---

## Execution Order

1. Part 1 (selections) — fast, no infrastructure changes
2. Part 2 (FTP pipeline) — medium, no NAS mounts needed
3. Part 3 (NAS pipeline) — slow, requires provisioning + rollouts

## Risk Mitigation
- Stale NAS volumes: pre-check + immediate patch-out on hang
- Port forwards breaking on rollout: restart after each rollout
- Pipeline service not consuming: check RabbitMQ queue depth, verify consumer registration
