---
phase: 03-protocol-test-coverage
plan: 03
subsystem: testing
tags: [nfs, kafka, integration-tests, k8s-pvc, xunit, skippable-fact]

# Dependency graph
requires:
  - phase: 03-01
    provides: FileSimulatorFixture pattern, xunit.SkippableFact usage
  - phase: 02-04
    provides: NfsConnector implementation
provides:
  - NFS connector integration tests (6 tests)
  - Kafka connector integration tests (6 tests)
  - K8s pod execution documentation for NFS testing
affects: [03-04, 10-nas-datasource]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NFS_MOUNT_PATH environment variable for K8s pod testing
    - Kafka IDataSourceConnector testing via KafkaFixture

key-files:
  created:
    - tests/IntegrationTests/Connectors/NfsConnectorTests.cs
    - tests/IntegrationTests/Connectors/KafkaConnectorTests.cs
  modified: []

key-decisions:
  - "NFS tests use NFS_MOUNT_PATH env var to detect K8s pod context"
  - "Logical tests (ConnectorType, FailsGracefully) run without mount"
  - "Kafka tests use KafkaFixture for broker operations, not AdminServer"

patterns-established:
  - "K8s-dependent tests document execution requirements in class-level comments"
  - "Environment variable-based feature detection for platform-specific tests"

# Metrics
duration: 4min
completed: 2026-02-02
---

# Phase 3 Plan 3: NFS and Kafka Connector Tests Summary

**NFS connector tests with K8s PVC mount context documentation, Kafka connector tests using KafkaFixture**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-02T13:47:24Z
- **Completed:** 2026-02-02T13:51:18Z
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- Created NfsConnectorTests with mount-aware skip logic (6 tests)
- Created KafkaConnectorTests using KafkaFixture (6 tests)
- Documented K8s pod execution requirements for full NFS testing
- All tests have correct traits (Protocol, Category, OCP)

## Task Commits

Each task was committed atomically:

1. **Task 1: NFS connector tests** - `7414ec6` (test)
2. **Task 2: Kafka connector tests** - `20844af` (test)

## Files Created/Modified

- `tests/IntegrationTests/Connectors/NfsConnectorTests.cs` - NFS connector tests with K8s context docs
- `tests/IntegrationTests/Connectors/KafkaConnectorTests.cs` - Kafka connector tests via KafkaFixture

## Decisions Made

1. **NFS tests use environment variable detection** - NFS_MOUNT_PATH env var indicates K8s pod context where PVC mounts exist. This allows logical tests to run locally while mount-dependent tests skip with clear messages.

2. **Kafka tests use IDataSourceConnector interface** - KafkaConnector implements IDataSourceConnector, not IServerConnector. Tests use DataProcessingDataSource for configuration instead of AdminServer.

3. **Comprehensive class-level documentation** - NfsConnectorTests includes detailed comments explaining the K8s execution context, how to run full tests in pods, and the mount path convention.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All NFS and Kafka tests implemented
- Test count now: 32 protocol tests (14 Wave 1 + 6 S3/SMB + 6 NFS + 6 Kafka)
- Ready for 03-04: Local connector tests (final plan in Phase 3)

---
*Phase: 03-protocol-test-coverage*
*Completed: 2026-02-02*
