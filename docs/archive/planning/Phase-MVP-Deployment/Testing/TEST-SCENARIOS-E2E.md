# E2E Test Scenarios - EZ Platform MVP

**Version:** 1.0
**Date:** December 2, 2025
**Priority:** P0 - Critical
**Execution:** Week 3

---

## Overview

This document contains 6 comprehensive end-to-end test scenarios that validate the complete EZ Platform file processing pipeline from file discovery through multi-destination output.

### Scenario Summary

| ID | Name | Duration | Records | Priority |
|----|------|----------|---------|----------|
| E2E-001 | Complete Pipeline | 15 min | 100 | P0 |
| E2E-002 | Multi-Destination | 20 min | 200 | P0 |
| E2E-003 | Multiple Formats | 30 min | 600 | P0 |
| E2E-004 | Schema Validation | 15 min | 200 | P0 |
| E2E-005 | Connection Failures | 25 min | 50 | P1 |
| E2E-006 | High Load | 60 min | 10,000 | P0 |

---

## E2E-001: Complete File Processing Pipeline

### Test Objective
Validate the entire end-to-end workflow from file discovery through validation to multi-destination output.

### Test ID: E2E-001
### Priority: P0 - Critical
### Estimated Duration: 15 minutes

### Preconditions
- [ ] K8s cluster healthy (all 9 services running)
- [ ] Kafka operational (3 brokers)
- [ ] MongoDB operational
- [ ] Hazelcast operational (3 nodes)
- [ ] Test datasource created: `test-ds-e2e-001`
- [ ] Input folder: `/data/input/e2e-001/`
- [ ] Output configured:
  - Kafka topic: `e2e-001-output`
  - Folder: `/data/output/e2e-001/`

### Test Data
- **File:** `customer-transactions-100.csv`
- **Location:** `tools/TestDataGenerator/TestFiles/E2E-001/`
- **Format:** CSV with headers
- **Size:** ~50KB
- **Records:** 100 valid, 0 invalid
- **Schema:** `schemas/customer-transaction-v1.json`

### Test Steps

#### Step 1: Upload Test File
**Action:**
```bash
cp tools/TestDataGenerator/TestFiles/E2E-001/customer-transactions-100.csv \
   /data/input/e2e-001/
```

**Expected Result:**
- File copied successfully
- File size: ~50KB
- File timestamp: [Current time]

**Actual Result:** _[To be filled during test execution]_

**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

#### Step 2: FileDiscoveryService Detection (< 5 seconds)
**Action:**
```bash
kubectl logs -l app=filediscovery --tail=100 | grep "customer-transactions-100"
```

**Expected Result:**
```
[INFO] File discovered: customer-transactions-100.csv
[INFO] DataSource: test-ds-e2e-001
[INFO] FilePath: /data/input/e2e-001/customer-transactions-100.csv
[INFO] FileSize: 51234 bytes
[INFO] Publishing FileDiscoveredEvent
```

**Monitoring Checkpoints:**
- [ ] Log shows "File discovered" within 5 seconds
- [ ] Correct datasource ID logged
- [ ] File path correct
- [ ] FileDiscoveredEvent published to Kafka

**Actual Result:** _[To be filled]_

**Timestamp Discovered:** ___________
**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

#### Step 3: FileProcessorService Processing (< 10 seconds)
**Action:**
```bash
kubectl logs -l app=fileprocessor --tail=100 | grep "customer-transactions-100"
```

**Expected Result:**
```
[INFO] Received FileDiscoveredEvent: customer-transactions-100.csv
[INFO] Reading file from: /data/input/e2e-001/customer-transactions-100.csv
[INFO] Converting CSV to JSON: 100 records
[INFO] Cached in Hazelcast: key=test-ds-e2e-001:customer-transactions-100:20251202...
[INFO] Publishing ValidationRequestEvent
```

**Monitoring Checkpoints:**
- [ ] File read successfully
- [ ] 100 records converted to JSON
- [ ] Hazelcast cache entry created
- [ ] ValidationRequestEvent published

**Actual Result:** _[To be filled]_

**Processing Duration:** _______ seconds
**Records Converted:** _______
**Hazelcast Key:** _______________________
**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

#### Step 4: ValidationService Processing (< 15 seconds)
**Action:**
```bash
kubectl logs -l app=validation --tail=100 | grep "customer-transactions-100"
```

**Expected Result:**
```
[INFO] Received ValidationRequestEvent
[INFO] Retrieved schema: customer-transaction-v1
[INFO] Retrieved records from Hazelcast: 100 records
[INFO] Validating 100 records against schema
[INFO] Validation complete: 100 valid, 0 invalid
[INFO] Metrics calculated: [list of metrics]
[INFO] Publishing ValidationCompletedEvent
```

**Monitoring Checkpoints:**
- [ ] Schema retrieved successfully
- [ ] Records retrieved from Hazelcast
- [ ] All 100 records validated successfully
- [ ] 0 invalid records
- [ ] Metrics calculated and published to Prometheus
- [ ] ValidationCompletedEvent published

**Actual Result:** _[To be filled]_

**Validation Duration:** _______ seconds
**Valid Records:** _______
**Invalid Records:** _______
**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

#### Step 5: OutputService Processing (< 20 seconds)
**Action:**
```bash
kubectl logs -l app=output --tail=100 | grep "customer-transactions-100"
```

**Expected Result:**
```
[INFO] Received ValidationCompletedEvent
[INFO] Retrieved datasource configuration: test-ds-e2e-001
[INFO] Retrieved records from Hazelcast: 100 records
[INFO] Processing 2 output destinations
[INFO] Destination 1: Kafka (topic=e2e-001-output)
[INFO] Destination 2: Folder (path=/data/output/e2e-001/)
[INFO] Writing to Kafka: 100 records
[INFO] Kafka write successful
[INFO] Writing to Folder: customer-transactions-100.csv
[INFO] Folder write successful
[INFO] Cleaning up Hazelcast cache
[INFO] Output processing complete
```

**Monitoring Checkpoints:**
- [ ] Records retrieved from Hazelcast
- [ ] Both destinations processed
- [ ] Kafka write successful
- [ ] Folder write successful
- [ ] Hazelcast cache cleaned up

**Actual Result:** _[To be filled]_

**Output Duration:** _______ seconds
**Destinations Processed:** _______
**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

#### Step 6: Verify Kafka Output
**Action:**
```bash
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic e2e-001-output --from-beginning --max-messages 100 > /tmp/kafka-output.json

wc -l /tmp/kafka-output.json
```

**Expected Result:**
- 100 lines (100 records)
- Each line is valid JSON
- Records match input data structure

**Actual Result:** _[To be filled]_

**Records in Kafka:** _______
**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

#### Step 7: Verify Folder Output
**Action:**
```bash
ls -lh /data/output/e2e-001/
wc -l /data/output/e2e-001/customer-transactions-100.csv
```

**Expected Result:**
- File exists: `customer-transactions-100.csv`
- File size: ~50KB
- 101 lines (100 data + 1 header)

**Actual Result:** _[To be filled]_

**File Exists:** [ ] Yes [ ] No
**File Size:** _______
**Line Count:** _______
**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

#### Step 8: Verify Metrics in Prometheus
**Action:**
```bash
curl -s http://localhost:9090/api/v1/query?query=files_processed_total | jq
curl -s http://localhost:9090/api/v1/query?query=records_valid_total | jq
curl -s http://localhost:9090/api/v1/query?query=records_invalid_total | jq
```

**Expected Result:**
```json
files_processed_total: 1
records_valid_total: 100
records_invalid_total: 0
processing_duration_seconds: [< 60]
```

**Actual Result:** _[To be filled]_

**Files Processed:** _______
**Valid Records:** _______
**Invalid Records:** _______
**Duration:** _______ seconds
**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

#### Step 9: Verify No Invalid Records in MongoDB
**Action:**
```bash
kubectl exec -it mongodb-0 -- mongosh ezplatform --eval \
  "db.InvalidRecords.find({DataSourceId: 'test-ds-e2e-001'}).count()"
```

**Expected Result:**
- Count: 0 (no invalid records)

**Actual Result:** _[To be filled]_

**Invalid Record Count:** _______
**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

#### Step 10: Verify Hazelcast Cache Cleanup
**Action:**
```bash
# Check Hazelcast for remaining cache entries
kubectl logs -l app=output --tail=50 | grep "Hazelcast cleanup"
```

**Expected Result:**
```
[INFO] Hazelcast cleanup successful
```

**Actual Result:** _[To be filled]_

**Cache Cleaned:** [ ] Yes [ ] No
**Status:** [ ] Pass [ ] Fail
**Notes:** _______________

---

### Final Verification Checklist

- [ ] File processed end-to-end in < 60 seconds
- [ ] 100 records in Kafka output
- [ ] 100 records in Folder output
- [ ] 0 invalid records in MongoDB
- [ ] Correct metrics in Prometheus
- [ ] Hazelcast cache cleaned up
- [ ] No errors in any service logs

### Cleanup
```bash
rm /data/input/e2e-001/customer-transactions-100.csv
rm /data/output/e2e-001/customer-transactions-100.csv
# Reset Kafka topic
kafka-topics --delete --topic e2e-001-output --bootstrap-server localhost:9092
kafka-topics --create --topic e2e-001-output --bootstrap-server localhost:9092
```

### Test Summary

**Overall Status:** [ ] PASS [ ] FAIL
**Total Duration:** _______ minutes
**Pass Rate:** _____ / 10 steps

**Defects Found:**
1. [DEFECT-XXX] - [Description] - [Priority]

**Tester Sign-off:** _____________ Date: _______
**Reviewer Sign-off:** _____________ Date: _______

---

## E2E-002: Multi-Destination Output

### Test Objective
Validate that a single file can be written to multiple destinations (3+ Kafka topics and folders) with different output formats.

### Test ID: E2E-002
### Priority: P0 - Critical
### Estimated Duration: 20 minutes

### Preconditions
- [ ] All services healthy
- [ ] Test datasource created: `test-ds-e2e-002`
- [ ] 4 destinations configured:
  1. Kafka topic: `e2e-002-kafka-1` (format: JSON)
  2. Kafka topic: `e2e-002-kafka-2` (format: JSON, include invalid)
  3. Folder: `/data/output/e2e-002-folder-1/` (format: Original)
  4. Folder: `/data/output/e2e-002-folder-2/` (format: CSV, overrides)

### Test Data
- **File:** `banking-transactions-200.csv`
- **Records:** 200 valid
- **Schema:** `banking-transaction-v1.json`

### Test Steps

#### Step 1: Upload File
```bash
cp tools/TestDataGenerator/TestFiles/E2E-002/banking-transactions-200.csv \
   /data/input/e2e-002/
```

**Expected:** File copied successfully

---

#### Step 2-4: Verify Processing Pipeline
[Similar structure to E2E-001 steps 2-4]

---

#### Step 5: Verify OutputService Processes All 4 Destinations
**Action:**
```bash
kubectl logs -l app=output --tail=200 | grep "e2e-002"
```

**Expected Result:**
```
[INFO] Processing 4 output destinations
[INFO] Destination 1: Kafka (topic=e2e-002-kafka-1, format=JSON)
[INFO] Destination 2: Kafka (topic=e2e-002-kafka-2, format=JSON, includeInvalid=true)
[INFO] Destination 3: Folder (path=/data/output/e2e-002-folder-1/, format=Original)
[INFO] Destination 4: Folder (path=/data/output/e2e-002-folder-2/, format=CSV)
[INFO] All 4 destinations processed successfully
```

**Monitoring:**
- [ ] All 4 destinations logged
- [ ] Each destination shows different configuration
- [ ] All destinations successful

**Actual Result:** _[To be filled]_
**Status:** [ ] Pass [ ] Fail

---

#### Step 6: Verify Kafka Destination 1
```bash
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic e2e-002-kafka-1 --from-beginning --max-messages 200 | wc -l
```

**Expected:** 200 records (JSON format)

**Actual:** _______
**Status:** [ ] Pass [ ] Fail

---

#### Step 7: Verify Kafka Destination 2
```bash
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic e2e-002-kafka-2 --from-beginning --max-messages 200 | wc -l
```

**Expected:** 200 records (includes invalid if any)

**Actual:** _______
**Status:** [ ] Pass [ ] Fail

---

#### Step 8: Verify Folder Destination 1 (Original Format)
```bash
ls -lh /data/output/e2e-002-folder-1/
file /data/output/e2e-002-folder-1/banking-transactions-200.csv
```

**Expected:** Original CSV file with 201 lines (header + 200 data)

**Actual:** _______
**Status:** [ ] Pass [ ] Fail

---

#### Step 9: Verify Folder Destination 2 (CSV Override)
```bash
ls -lh /data/output/e2e-002-folder-2/
wc -l /data/output/e2e-002-folder-2/banking-transactions-200.csv
```

**Expected:** CSV file (even if original was different format)

**Actual:** _______
**Status:** [ ] Pass [ ] Fail

---

#### Step 10: Verify Metrics Per Destination
```bash
curl -s http://localhost:9090/api/v1/query?query=output_destinations_processed_total | jq
curl -s http://localhost:9090/api/v1/query?query=output_destinations_failed_total | jq
```

**Expected:**
- `output_destinations_processed_total{datasource="e2e-002"}`: 4
- `output_destinations_failed_total{datasource="e2e-002"}`: 0

**Actual:** _______
**Status:** [ ] Pass [ ] Fail

---

### Final Verification
- [ ] All 4 destinations received the file
- [ ] Each destination has correct format
- [ ] Total processing time < 30 seconds
- [ ] No failed destinations
- [ ] Correct metrics

### Test Summary
**Overall Status:** [ ] PASS [ ] FAIL
**Destinations Successful:** _____ / 4

---

## E2E-003: Multiple File Formats

[Continue with similar detailed structure for remaining scenarios...]

---

## E2E-004: Schema Validation
[Detailed steps for testing valid/invalid records...]

---

## E2E-005: Connection Failures
[Detailed steps for testing failure scenarios...]

---

## E2E-006: High Load Testing
[Detailed steps for testing 1000+ files...]

---

## Test Execution Guidelines

### Before Starting Any Scenario
1. Verify all preconditions
2. Generate test data using TestDataGenerator
3. Clear previous test outputs
4. Capture baseline metrics

### During Test Execution
1. Follow steps sequentially
2. Record actual results immediately
3. Capture screenshots for failures
4. Note exact timestamps
5. Save relevant log excerpts

### After Each Scenario
1. Complete all verification steps
2. Fill in test summary
3. Log any defects found
4. Clean up test data
5. Sign-off if passed

### If Test Fails
1. Mark step as FAIL immediately
2. Capture full error details
3. Save complete logs
4. Create defect report (DEFECT-XXX)
5. DO NOT continue to next scenario
6. Notify test lead

---

**Document Status:** ✅ Active
**Last Updated:** December 2, 2025
