# Codebase Concerns

**Analysis Date:** 2026-02-02

## Tech Debt

**Connection Testing Not Implemented:**
- Issue: DataSourceService returns hardcoded success response without actual connection validation
- Files: `src/Services/DataSourceManagementService/Services/DataSourceService.cs:617`
- Impact: Users cannot verify data source connectivity before scheduling; failed connections may only be discovered during processing
- Fix approach: Implement actual connector-based connection testing (FTP, SFTP, HTTP, S3, Kafka) with configurable timeouts; catch and report specific connection errors

**Alert Triggered Event Not Published:**
- Issue: When alert thresholds are exceeded, no downstream event is published for notification/integration
- Files: `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs:454`
- Impact: Alert evaluations run but have no effect; notifications cannot be sent; monitoring system is incomplete
- Fix approach: Publish `AlertTriggeredEvent` with alert details, metric value, severity, and data source context for downstream consumers

**Output Completed Event Not Published:**
- Issue: Output service processes validation results but does not emit completion event
- Files: `src/Services/OutputService/Consumers/ValidationCompletedEventConsumer.cs:221`
- Impact: No visibility into output completion; monitoring dashboards cannot track end-to-end completion; no trigger for post-processing steps
- Fix approach: Publish `OutputCompletedEvent` with record counts, output destinations, processing duration, and correlation ID

**Alert Notifications Not Integrated:**
- Issue: Alert evaluation service has TODO comment indicating NotificationService integration is not implemented
- Files: `src/Services/MetricsConfigurationService/Services/Alerts/AlertEvaluationService.cs:85`
- Impact: Alerts are evaluated but never sent to users; no email, Slack, or webhook notifications
- Fix approach: Implement NotificationService consumer; integrate with email/Slack/webhook providers; add notification preferences to AlertRule entity

## Known Bugs

**Browser Cache Issue (Resolved - v0.2.0):**
- Symptoms: Old v0.1.15 UI appears despite v0.2.0 code deployed; archive settings and server selection not visible
- Files: `src/Frontend/nginx.conf`, `k8s/deployments/frontend.yaml`
- Trigger: Browser caches static assets aggressively; pod restart or deployment update doesn't clear client-side cache
- Workaround: Hard refresh (Ctrl+Shift+R), clear browser cache, or use incognito window
- Status: FIXED - nginx.conf now includes proper Cache-Control headers; HTML always fresh, assets cached 7 days with ETag validation
- Documentation: `docs/troubleshooting/v0.2.0-browser-cache-issue.md`

## Security Considerations

**Credential Handling in Kubernetes:**
- Risk: Server credentials (passwords, API keys, SSH keys) stored in Kubernetes Secrets; requires RBAC access to secrets API
- Files: `src/Services/Shared/Services/KubernetesCredentialResolver.cs`, `src/Services/Shared/Services/ICredentialResolver.cs`
- Current mitigation: Resolver checks for Forbidden (403) responses and logs RBAC permission issues; credentials never logged (uses redacted ToString()); connections use secrets, not environment variables
- Recommendations:
  - Verify RBAC policies restrict secret read access to service accounts only
  - Consider secret encryption at rest in etcd (enable `--encryption-provider-config` on API server)
  - Add audit logging for secret access
  - Implement secret rotation policy (30-90 day rotation)

**Hazelcast Distributed Cache Authorization:**
- Risk: Hazelcast cluster stores cached file content in memory; no built-in authentication in current configuration
- Files: `src/Services/Shared/Configuration/HazelcastConfiguration.cs:71-95`
- Current mitigation: Hazelcast runs in isolated K8s cluster with network policies
- Recommendations:
  - Enable Hazelcast authentication (`Identity` and `Credentials` in HazelcastOptions)
  - Implement network policy to restrict Hazelcast port 5701 to service pods only
  - Consider enabling TLS for inter-node communication (`Networking.SSL` config)
  - Monitor cache evictions for unusual patterns

**Broad Exception Catching:**
- Risk: Many services catch generic `Exception` type, potentially masking programming errors or security issues
- Files: 30+ files including DataSourceService.cs, ServerService.cs, all connector classes
- Current mitigation: Logged exceptions include context and correlation IDs
- Recommendations: Catch specific exception types (OperationException, TimeoutException, etc.) rather than broad Exception; only catch Exception at service boundaries for fallback behavior

## Performance Bottlenecks

**ReadAllBytes for Large Files:**
- Problem: LocalFileConnector loads entire file into memory with `File.ReadAllBytesAsync()`
- Files: `src/Services/Shared/Connectors/LocalFileConnector.cs:272`
- Cause: No streaming API; works for typical files but breaks for files >1GB
- Current limit: CLAUDE.md states max tested file size is 100 records (roughly 10-50KB); no large file testing
- Improvement path: Implement streaming read via `FileStream` and chunked processing; modify IDataSourceConnector to return Stream instead of byte array; update converters to handle streaming input

**File.ReadAllText for Resource Files:**
- Problem: Error response factory loads JSON resource files entirely into memory
- Files: `src/Services/DataSourceManagementService/Infrastructure/HebrewErrorResponseFactory.cs:208`
- Cause: Small resource files but inefficient pattern; could fail if file not found after retry
- Improvement path: Load resource files once at startup; cache in static field; use embedded resources instead of filesystem reads

**Kafka Consumer Timeout Fixed Value:**
- Problem: Kafka connector uses hardcoded 5-second timeout for message consumption
- Files: `src/Services/Shared/Connectors/KafkaConnector.cs:97`
- Cause: No configuration option; breaks for slow networks or large messages
- Improvement path: Make timeout configurable via ConnectorConfiguration or AdminServer properties; add per-message timeout settings

**Hazelcast Cache Query Without Index:**
- Problem: Hazelcast cache operations may not be optimized for query performance
- Files: `src/Services/Shared/Configuration/HazelcastConfiguration.cs`
- Cause: No secondary indexes configured; full scans on cached data
- Improvement path: Add indexes on frequently queried cache keys; use `Hazelcast.Predicates` for efficient filtering; benchmark cache hit rates

## Fragile Areas

**Distributed Lock Implementation (DataSource Processing):**
- Files: `src/Services/Shared/Entities/DataProcessingDataSource.cs:221-261`
- Why fragile:
  - Stateless lock based on entity properties (IsCurrentlyProcessing, ProcessingStartedAt, ProcessingPodId)
  - No atomic compare-and-swap; race condition possible if two services acquire lock simultaneously
  - Timeout of 5 minutes assumes graceful shutdown; orphaned locks if pod is killed (though SIGTERM hooks help)
  - No lock owner validation; any service can release any lock
- Safe modification:
  - Always use within transaction with MongoDB's optimistic concurrency (Version field)
  - Call `MarkAsModified()` after lock operations
  - Verify ProcessingPodId before releasing lock from another pod
  - Consider upgrading to MongoDB native distributed lock library
- Test coverage: Gaps - no unit tests for concurrent lock acquisition; only E2E scenarios test this indirectly

**Validation Rule Expression Evaluation:**
- Files: `src/Services/MetricsConfigurationService/Services/Alerts/AlertEvaluationService.cs:109-200`
- Why fragile:
  - Uses simple string replacement for variable substitution; "false positive" if variable name is substring of another
  - No expression parser; evaluates via hardcoded comparison operators; cannot handle complex expressions (AND, OR, NOT)
  - Unsubstituted variables left in expression; may evaluate incorrectly if substitution fails silently
  - No timeout on expression evaluation; malformed expression could hang
- Safe modification:
  - Use proper expression parser library (e.g., NLua, Sprache, or custom JSON-based format)
  - Add validation that all variables in expression are defined before evaluation
  - Implement expression timeout (100ms max)
  - Add unit tests for edge cases: variable names that are substrings, missing variables, malformed operators
- Test coverage: Only tested with simple > < >= <= operators; no AND/OR, no variable edge cases

**Kafka Message Offset Management:**
- Files: `src/Services/Shared/Connectors/KafkaConnector.cs:40-116`
- Why fragile:
  - Manual offset management with `EnableAutoCommit: false` but no explicit commit calls
  - Consumer group rebalancing not handled; may lose or duplicate messages
  - No offset reset strategy if specified partition doesn't exist
  - Consumer not closed properly if exception occurs mid-consumption
- Safe modification:
  - Implement using statement for consumer lifecycle
  - Add explicit offset commit after processing; handle commit failures
  - Handle rebalancing with `OnAssign` and `OnRevoke` callbacks
  - Add offset reset configuration to AdminServer/ConnectorConfiguration
- Test coverage: Only tested with single message consumption; no high-volume, no rebalancing scenarios

**Archive Extraction with Path Traversal Risk:**
- Files: `src/Services/Shared/Services/SharpCompressArchiveService.cs`, `src/Services/Shared/Connectors/LocalFileConnector.cs`
- Why fragile:
  - Extracts archive contents to filesystem; path traversal in archive could escape extraction directory
  - No validation of extracted file paths; "../../etc/passwd" could be written outside intended directory
  - Archive password stored in plain text in entity; no encryption
- Safe modification:
  - Validate all extracted paths are within target directory using `Path.GetFullPath()` checks
  - Reject any paths containing ".."
  - Store archive password encrypted in database; decrypt only during extraction
  - Add unit tests for malicious archive paths
  - Consider extracting to temporary directory and validating before move to final destination
- Test coverage: Only happy path tested (valid archives); no security tests for path traversal

## Scaling Limits

**In-Memory Hazelcast Cache Fixed Size:**
- Current capacity: 256MB per map (file-content, valid-records)
- Limit: Breaks when cache size exceeds 256MB; LRU eviction may thrash frequently
- Trigger: Processing >50 large files (>5MB each) concurrently
- Scaling path:
  - Increase `max-size` in HazelcastConfiguration based on available pod memory
  - Implement TTL-based eviction instead of size-based (current: 300s); tune based on processing pipeline latency
  - Monitor cache hit/miss rates; if hit rate < 80%, increase size
  - Consider Redis cluster instead of Hazelcast for higher capacity (scales to terabytes)

**MongoDB Connection Pool:**
- Current capacity: MongoDB.Entities default pool size (not explicitly configured)
- Limit: K8s environment with multiple service replicas; pool exhaustion when concurrency > pool size
- Trigger: >10 concurrent file processing operations across services
- Scaling path:
  - Make MongoDB.Entities pool size configurable; set per-service based on expected concurrency
  - Monitor `mongodb_client_sessions_active` metric
  - Implement connection pool monitoring in health checks
  - Consider connection multiplexing if pool exhaustion occurs

**File Discovery Polling Scale:**
- Current capacity: Single FilePollingEventConsumer processes one schedule trigger at a time
- Limit: If discovery takes >schedule interval (e.g., hourly), polling falls behind
- Trigger: Data source with 10,000+ files; discovery takes 65 minutes but poll frequency is hourly
- Scaling path:
  - Implement parallel file discovery with concurrent batch processing
  - Add `MaxConcurrentDiscoveries` setting to SchedulingService
  - Consider event-driven discovery (watch for file system changes) instead of polling

**Validation Service Message Queue:**
- Current capacity: Hazelcast cache holds validation results; in-memory queue for pending validations
- Limit: Message broker (Kafka/RabbitMQ) memory fills if validation service becomes slow
- Trigger: Validation latency increases to >30 seconds per file; upstream FileProcessor produces faster than Validation consumes
- Scaling path:
  - Add dead-letter queue for messages that fail validation (already in MassTransit config)
  - Implement consumer rate limiting with backpressure
  - Monitor message broker queue depth; alert if >1000 pending messages
  - Scale ValidationService replicas based on queue depth

## Dependencies at Risk

**Corvus.Json.Validator (JSON Schema 2020-12):**
- Risk: Relatively new JSON Schema validator; limited adoption compared to Newtonsoft.Json
- Impact: May have undiscovered bugs in edge cases; security vulnerabilities may take longer to be reported
- Migration plan: Test comprehensive schema validation suite; have fallback to Newtonsoft.JsonSchema if issues arise; pin version to stable releases only

**SharpCompress (Archive Library):**
- Risk: Actively maintained but smaller community; security issues may be slow to patch
- Impact: Archive extraction vulnerabilities could expose production data
- Migration plan: Monitor security advisories; upgrade promptly; consider DotNetZip alternative if vulnerabilities emerge

**MongoDB.Entities ORM:**
- Risk: Abstracts MongoDB driver; bugs in LINQ translation could silently produce wrong queries
- Impact: Data access logic may not work as expected; optimistic concurrency using Version field relies on correct implementation
- Migration plan: Extensive integration testing of queries; consider switching to native MongoDB driver for critical paths; validate generated queries in debug mode

**Hazelcast.Net Client (Latest Version Not Pinned):**
- Risk: No explicit version pinned in .csproj; auto-updates to latest
- Impact: Breaking changes in minor version could break cache operations without notice
- Migration plan: Pin Hazelcast.Net to specific version; test new versions before upgrading; review changelog for breaking changes

## Missing Critical Features

**Connection Validation:**
- Problem: No real connection testing; users cannot verify settings before scheduling
- Blocks: Users discover connection errors only after files fail processing; cannot test FTP/SFTP credentials without running full pipeline
- Priority: HIGH - Affects user experience and delays troubleshooting

**Alert Notifications:**
- Problem: Alerts evaluate but have no effect; no way to notify users of issues
- Blocks: Monitoring setup is incomplete; cannot integrate with PagerDuty, Slack, email, etc.
- Priority: HIGH - Core monitoring feature missing

**Output Event Publishing:**
- Problem: No confirmation when output completes; downstream systems cannot react
- Blocks: Cannot trigger post-processing workflows; monitoring cannot track end-to-end pipeline
- Priority: MEDIUM - Affects observability and integration

**Unit Test Coverage for Backend:**
- Problem: No .Tests projects found for backend services; integration tests only
- Blocks: Cannot verify business logic in isolation; changes to core logic are risky
- Priority: MEDIUM - Reduces confidence in refactoring

**XML and JSON Format Support in Validation:**
- Problem: Only CSV and Excel fully tested in validation pipeline
- Blocks: Users cannot process XML or JSON files reliably
- Priority: MEDIUM - Limits data format support

## Test Coverage Gaps

**Multiple File Format Validation:**
- What's not tested: XML, JSON, Parquet file validation; only CSV and Excel tested
- Files: `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs`, `src/Services/Shared/Converters/`
- Risk: Format-specific validation bugs (XML namespace issues, JSON nested arrays, Parquet column type mismatches) could fail silently in production
- Priority: HIGH - Affects 2/5 supported formats

**High Load Testing:**
- What's not tested: Files with >100 records; concurrent processing of >2 files; cache behavior under load
- Files: All service consumers
- Risk: Memory leaks, deadlocks, or performance degradation only discovered in production under load
- Priority: HIGH - Production deployment without load testing is risky

**Multi-Destination Output Scaling:**
- What's not tested: Output to >2 destinations from single file; distribution across Kafka, S3, HTTP, Folder simultaneously
- Files: `src/Services/OutputService/Consumers/ValidationCompletedEventConsumer.cs`
- Risk: Race conditions, cascading failures, or partial output if one destination fails
- Priority: MEDIUM - Feature works for 2 destinations but may break with 3+

**Error Recovery and Retry Logic:**
- What's not tested: Message broker connectivity loss during processing; database unavailable during transaction; partial file writes recovery
- Files: All services' error handling
- Risk: Unclean state, orphaned locks, or data corruption if infrastructure fails mid-operation
- Priority: MEDIUM - E2E-006 tests basic recovery but not infrastructure failure scenarios

**Hazelcast Cache Failover:**
- What's not tested: Hazelcast pod crash during processing; cache loss; reconnection behavior
- Files: `src/Services/Shared/Configuration/HazelcastConfiguration.cs`, cache usage in consumers
- Risk: If Hazelcast goes down, file content and validation results are lost; services may hang waiting for cache responses
- Priority: MEDIUM - Single point of failure

**Archive Extraction Edge Cases:**
- What's not tested: Malicious archives with path traversal, nested archives, password-protected archives with wrong password, corrupted archives
- Files: `src/Services/Shared/Services/SharpCompressArchiveService.cs`
- Risk: Security vulnerability (path traversal) or service crash if archive is malformed
- Priority: HIGH - Security-relevant

**Credential Resolution Failures:**
- What's not tested: Missing Kubernetes secret, RBAC permission denied, secret format invalid
- Files: `src/Services/Shared/Services/KubernetesCredentialResolver.cs`, credential resolution in connectors
- Risk: Services fail to start or hang if credential resolution is broken; user sees unclear error message
- Priority: MEDIUM - Affects operational reliability

---

*Concerns audit: 2026-02-02*
