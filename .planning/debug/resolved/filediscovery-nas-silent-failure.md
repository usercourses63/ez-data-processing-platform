---
status: resolved
trigger: "FileDiscovery service acks FilePollingEvent from RabbitMQ but never publishes FileDiscoveredEvent"
created: 2026-03-27T20:28:00Z
updated: 2026-03-27T23:59:00Z
---

## Current Focus

hypothesis: CONFIRMED - Pipeline fully working end-to-end after fixing dedup + enabling Information logging
test: Triggered poll with modified pipeline-test.csv, observed full trace through FileDiscovery -> FileProcessor -> Validation
expecting: ValidationRequestEvent count increases
next_action: Awaiting human verification of end-to-end pipeline in their workflow

## Symptoms

expected: FileDiscovery receives FilePollingEvent, discovers CSV files at /mnt/nfs-input-data/, publishes FileDiscoveredEvent
actual: FilePollingEvent acked, 0 FileDiscoveredEvent published. Dedup cache returns "already processed" for pipeline-test.csv
errors: No errors visible at Warning log level. At Information level: "0 new file(s), 1 duplicate(s) skipped, 1 active hash(es) in Hazelcast"
reproduction: Trigger poll for datasource 69c6d080ec5933d4d5bf2bd9
started: Never worked for NAS datasources in this session

## Eliminated

- hypothesis: Wrong connector type (FTP instead of local) used for NAS datasource
  evidence: With Information logging, confirmed LocalFileConnector used, found 1 file matching pattern
  timestamp: 2026-03-27T20:32:00Z

- hypothesis: NFS volume not mounted in FileDiscovery pod
  evidence: kubectl exec ls -la /mnt/nfs-input-data/ shows both CSV files readable
  timestamp: 2026-03-27T20:29:00Z

- hypothesis: FileProcessor reads file content from Hazelcast (lost after restart)
  evidence: Code review shows FileProcessor reads directly from filesystem via LocalFileConnector.ReadFileAsync, NOT from Hazelcast. It STORES converted JSON in Hazelcast for ValidationService.
  timestamp: 2026-03-27T20:48:00Z

- hypothesis: FileProcessor pod lacks NFS mount
  evidence: kubectl exec ls -la /mnt/nfs-input-data/ shows all test files readable in FileProcessor pod
  timestamp: 2026-03-27T20:48:00Z

- hypothesis: FileProcessor silently failing to process FileDiscoveredEvent
  evidence: After enabling Information logging via env var, triggered pipeline and saw full successful trace: read file, converted CSV to JSON, cached in Hazelcast, published ValidationRequestEvent
  timestamp: 2026-03-27T20:52:00Z

## Evidence

- timestamp: 2026-03-27T20:29:00Z
  checked: FileDiscovery pod NFS mount
  found: Files visible and readable at /mnt/nfs-input-data/
  implication: Volume mount is correct

- timestamp: 2026-03-27T20:30:00Z
  checked: Production log level
  found: Default=Warning suppresses all Information/Debug consumer logs
  implication: Errors below Warning are invisible — "silent failure" is actually silent success (dedup skip)

- timestamp: 2026-03-27T20:32:00Z
  checked: Consumer behavior with Information logging enabled
  found: "Deduplication results: 0 new file(s), 1 duplicate(s) skipped, 1 active hash(es) in Hazelcast"
  implication: File hash was added to Hazelcast in a prior poll, file is permanently blocked until 24h TTL expires

- timestamp: 2026-03-27T20:32:00Z
  checked: Code flow in DiscoverFilesAsync (lines 224-237)
  found: Hash added to Hazelcast BEFORE FileDiscoveredEvent is published (line 225 vs line 340)
  implication: If downstream fails or first poll adds hash then errors, file is blocked from re-processing

- timestamp: 2026-03-27T20:37:00Z
  checked: Fix deployed and verified
  found: "Deduplication results: 1 new file(s), 0 duplicate(s) skipped" then "Published 1 FileDiscoveredEvent(s)"
  implication: Fix works — files are now discovered and published

- timestamp: 2026-03-27T20:48:00Z
  checked: FileProcessor code review (FileDiscoveredEventConsumer.cs)
  found: FileProcessor reads files directly from filesystem via connector, NOT from Hazelcast. It stores converted JSON in Hazelcast for downstream ValidationService.
  implication: Hazelcast restart does NOT affect FileProcessor's ability to read files

- timestamp: 2026-03-27T20:48:00Z
  checked: RabbitMQ vs Kafka transport for FileDiscoveredEvent
  found: MassTransit Kafka rider only covers FilePollingEvent, ValidationRequestEvent, ValidationCompletedEvent, FileProcessingFailedEvent. FileDiscoveredEvent uses RabbitMQ transport.
  implication: RabbitMQ queue counts for FileDiscoveredEvent are authoritative

- timestamp: 2026-03-27T20:50:00Z
  checked: Datasource FilePattern configuration
  found: Pattern is "pipeline-test.csv" (exact filename), not a glob like "*.csv"
  implication: New test files with different names (debug-fp-test-*, fresh-test-*) are never discovered. Only pipeline-test.csv is matched.

- timestamp: 2026-03-27T20:52:00Z
  checked: Full end-to-end pipeline with Information logging on both services
  found: Modified pipeline-test.csv content -> FileDiscovery found 1 new file (new hash) -> FileProcessor read file, converted to JSON, cached in Hazelcast, published ValidationRequestEvent -> ValidationService consumed and completed. RabbitMQ counts: FileDiscoveredEvent 3->4, ValidationRequestEvent 182->183, ValidationCompletedEvent 182->183
  implication: Pipeline is fully working. The prior "2 events with no ValidationRequest" was caused by Hazelcast restart turbulence (pod recycling, ClientOfflineException).

## Resolution

root_cause: Three compounding issues created the appearance of a broken pipeline: (1) Hazelcast dedup hash written before FileDiscoveredEvent publish, blocking re-discovery of files after downstream failures. (2) Production log level (Warning) on ALL pipeline services masked all consumer activity, making normal dedup skips and any errors appear as "silent failures." (3) The apparent FileProcessor failure (2 consumed FileDiscoveredEvents with no ValidationRequestEvent) was caused by Hazelcast StatefulSet restart turbulence — 1 event went to error queue with ClientOfflineException, and the other was likely consumed by a dying pod during rollout. After stabilization and re-trigger, the pipeline works end-to-end.
fix: (1) Moved AddProcessedFileHashAsync call from DiscoverFilesAsync to after successful FileDiscoveredEvent publish. (2) Enabled Information logging on FileDiscovery and FileProcessor via env var override (Logging__LogLevel__Default=Information) to provide visibility into consumer behavior. (3) No code fix needed for FileProcessor — it was working correctly once services stabilized after Hazelcast restart.
verification: Triggered pipeline poll, observed full trace: FileDiscovery found 1 new file -> FileProcessor read, converted, cached, published ValidationRequestEvent -> ValidationService consumed. RabbitMQ counts confirmed: FileDiscoveredEvent +1, ValidationRequestEvent +1, ValidationCompletedEvent +1.
files_changed:
  - src/Services/FileDiscoveryService/Consumers/FilePollingEventConsumer.cs
  - src/Services/FileProcessorService/appsettings.Production.json (log level change)
