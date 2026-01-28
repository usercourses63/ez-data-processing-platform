# Codebase Concerns

**Analysis Date:** 2026-01-28

## Tech Debt

**Connection Testing Stub Implementation:**
- Issue: `TestConnectionAsync()` in `DataSourceManagementService/Services/DataSourceService.cs` (line 617) returns hardcoded success without actual connection validation
- Files: `src/Services/DataSourceManagementService/Services/DataSourceService.cs` (lines 616-630)
- Impact: Users receive false positive connection status. Invalid credentials/unreachable hosts are not detected until actual data processing fails
- Fix approach: Implement real connection testing by instantiating appropriate connector (`IDataSourceConnector`) and testing actual connection parameters. Add timeout and error handling for each connector type (FTP, SFTP, HTTP, Kafka, S3)

**Missing Event Publishing in Output Service:**
- Issue: `ValidationCompletedEventConsumer.Consume()` has TODO comment for publishing `OutputCompletedEvent`
- Files: `src/Services/OutputService/Consumers/ValidationCompletedEventConsumer.cs` (line 221)
- Impact: Downstream monitoring and alerting systems cannot track output completion. No event-based notifications available for output failures
- Fix approach: Implement and publish `OutputCompletedEvent` containing output destination details, success/failure status, and processed record count

**Alert Triggered Event Stub:**
- Issue: `ValidationRequestEventConsumer` has TODO for publishing `AlertTriggeredEvent` when validation triggers alerts
- Files: `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs` (line 454)
- Impact: Alert system cannot react to validation failures in real-time. Only metrics available post-processing
- Fix approach: Publish `AlertTriggeredEvent` containing alert rule ID, triggered condition, and affected records

**Metrics Configuration Cache Limitation:**
- Issue: `VisualFormulaBuilder.tsx` uses mock fields with TODO to fetch actual schema fields from API
- Files: `src/Frontend/src/components/metrics/VisualFormulaBuilder.tsx` (line 126)
- Impact: Formula builder cannot adapt to actual data source schema. Users must manually verify field names exist
- Fix approach: Implement API call to `GET /api/v1/schemas/{schemaId}/fields` and dynamically populate field selector

**Missing Error Tracking Integration:**
- Issue: `ErrorBoundary.tsx` has TODO for sending errors to external tracking service (Sentry, etc.)
- Files: `src/Frontend/src/components/shared/ErrorBoundary.tsx` (line 42)
- Impact: Frontend errors silently fail without visibility. Production issues undetected until user reports
- Fix approach: Integrate Sentry or similar error tracking service. Send error context including correlation ID for linking to backend logs

## Known Bugs

**Browser Cache Invalidation (RESOLVED):**
- Symptoms: Browser displaying v0.1.15 UI despite pod serving v0.2.0 code with archive settings
- Files: `src/Frontend/nginx.conf`, `src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx`
- Trigger: Browser cache retained old JavaScript bundles; hard refresh required
- Workaround: Ctrl+Shift+R hard refresh or use incognito window. Also resolved by updating nginx.conf with proper Cache-Control headers in v0.2.0 release
- Status: FIXED - nginx cache control headers added, Vite hash-based filenames prevent recurrence

## Security Considerations

**Elasticsearch Security Disabled (Development Only):**
- Risk: Elasticsearch deployed with `xpack.security.enabled=false`. No authentication or encryption for log access
- Files: `docker-compose.development.yml` (line 127), `k8s/infrastructure/elasticsearch.yaml`
- Current mitigation: Development environment only. Minikube runs on localhost without external exposure
- Recommendations: Before production deployment, enable X-Pack security with username/password authentication. Use TLS for cluster communication. Consider network policies restricting Elasticsearch access

**Grafana Hardcoded Credentials:**
- Risk: Grafana admin credentials hardcoded in Kubernetes deployment manifests (admin/admin)
- Files: `k8s/deployments/grafana.yaml`, Grafana provisioning files
- Current mitigation: Only accessible through kubectl port-forward from localhost
- Recommendations: Use Kubernetes Secrets for credential storage. Implement RBAC for Grafana access. Change default credentials immediately in production

**MongoDB Direct Connection Bypass:**
- Risk: Connection strings support `directConnection=true` parameter which bypasses replica set routing and authentication
- Files: References in `DatabaseConfiguration.cs`, documented in CLAUDE.md
- Current mitigation: Replica set authentication enforced by MongoDB server-side
- Recommendations: Document secure connection string format. Prevent `directConnection` in production. Implement connection string validation. Ensure MongoDB replica set authentication is mandatory

**Missing Input Validation on File Paths:**
- Risk: File path parameters in connectors (Local, FTP, SFTP) not validated for directory traversal attacks
- Files: `src/Services/Shared/Connectors/LocalFileConnector.cs`, `FtpConnector.cs`, `SftpConnector.cs`
- Current mitigation: Filesystem permissions restrict access, but no explicit path validation
- Recommendations: Implement path normalization and whitelist validation. Reject paths containing `..` or absolute paths outside configured root directories

## Performance Bottlenecks

**Large File Processing Memory Pressure:**
- Problem: Files loaded entirely into memory during processing. 10,000+ record CSV files (~1.4MB) held in memory simultaneously
- Files: `src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs`, converters in `src/Services/Shared/Converters/`
- Cause: Entire file content cached in Hazelcast before validation. No streaming processing implemented
- Improvement path: Implement streaming JSON/CSV parsing. Process records in batches (100-1000 records). Remove Hazelcast caching for large files; use direct stream passthrough instead. Add memory monitoring and circuit breaker for files >10MB

**Hazelcast Cache TTL Mismatch:**
- Problem: Cache TTL set to 5 minutes but large file processing may exceed this duration
- Files: `k8s/infrastructure/hazelcast.yaml`, `src/Services/Shared/Configuration/HazelcastConfiguration.cs`
- Cause: Fixed TTL doesn't account for variable processing times. Long-running validations cause cache eviction mid-process
- Improvement path: Implement dynamic TTL based on file size (base + size*factor). Monitor cache hit rates. Add logging for eviction events. Consider persistent storage for large files instead of cache

**Query Pagination Default Size:**
- Problem: Default page size for data source listing not specified. Could load thousands of records unnecessarily
- Files: `src/Services/DataSourceManagementService/Models/Queries/DataSourceQuery.cs`
- Cause: No size limit enforced; potential for large result sets
- Improvement path: Set default page size to 20-50. Enforce maximum page size of 100. Add query performance monitoring

## Fragile Areas

**Consumer Message Ordering Not Guaranteed:**
- Files: All consumer classes in `src/Services/*/Consumers/`
- Why fragile: Consumers process messages independently without ordering guarantees. FileProcessingFailedEvent and ValidationCompletedEvent could process out-of-sequence
- Safe modification: Before modifying consumer logic, verify message ordering assumptions. Add sequence numbers to events. Implement saga pattern for multi-step processes that require ordering
- Test coverage: Consumer integration tests exist but do not verify ordering scenarios

**Validation Result Cache Eviction Race Condition:**
- Files: `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs` (lines 275-285)
- Why fragile: Code retrieves file content from Hazelcast cache but cache TTL can expire during validation. Race condition between cache check and retrieval
- Safe modification: Add cache existence check before retrieval. Implement retry logic with exponential backoff. Log cache misses
- Test coverage: No integration test covers cache eviction during long validation runs

**Archive Processing without Nested Validation:**
- Files: `src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs` (lines 390-410)
- Why fragile: Nested archive extraction assumes all nested files are valid. No recursive schema validation. Corrupted nested files cause extraction to fail without granular error reporting
- Safe modification: Add per-entry validation during extraction. Implement separate consumer for nested archives. Add archive integrity checking before processing
- Test coverage: Integration tests only verify happy path with valid archives. No tests for corrupted or malicious archive formats

**Schema Update During Active Processing:**
- Files: `src/Services/DataSourceManagementService/Services/Schema/SchemaService.cs`, `ValidationService`
- Why fragile: Schema can be updated while validation is in-flight using old schema. No version locking
- Safe modification: Implement schema versioning. Lock schema during active processing. Add schema version to ValidationRequestEvent
- Test coverage: No test for concurrent schema update during validation

## Scaling Limits

**Hazelcast Cluster Single Node in Production:**
- Current capacity: 256MB per map (hardcoded in config)
- Limit: Single node cluster has no redundancy. Node failure loses all cache. No data replication
- Scaling path: Configure Hazelcast cluster with 2-3 nodes. Enable data replication (backup count=1). Monitor memory usage. Implement LRU eviction with monitoring

**Kafka Consumer Group Lag:**
- Current capacity: Not monitored. No lag alerting configured
- Limit: Unknown lag threshold could cause message queue overflow. Consumer lag not visible in Grafana
- Scaling path: Add Kafka lag metrics to Prometheus. Configure alerts at 1000+ lag threshold. Implement consumer parallelization (increase partitions/consumer count). Add lag monitoring dashboard

**MongoDB Replica Set without Sharding:**
- Current capacity: Single replica set limited to node storage capacity
- Limit: No horizontal sharding for > 100GB datasets. Write scaling limited to single primary
- Scaling path: Plan MongoDB sharding by `correlationId` or `dataSourceId`. Monitor collection sizes. Implement data archiving for old records

**Frontend Component Tree Depth:**
- Current capacity: Deeply nested tab and modal structures (10+ levels)
- Limit: Re-renders cascade through entire tree. Performance degrades with 50+ data sources
- Scaling path: Implement React.memo for list components. Extract state to context. Add lazy loading for tabs. Monitor render performance with React DevTools Profiler

## Dependencies at Risk

**Newtonsoft.Json Version Compatibility:**
- Risk: `Newtonsoft.Json` used in multiple services alongside `System.Text.Json`. Version conflicts possible during upstream updates
- Impact: JSON serialization inconsistencies. Different date formatting between services
- Migration plan: Standardize on `System.Text.Json` across all services. Update converters to use new API. Plan migration service-by-service with integration tests

**Ant Design 5.x RTL Stability:**
- Risk: RTL support in Ant Design 5.x marked as experimental. Minor version updates could break Hebrew layout
- Impact: Hebrew UI misalignment, field order issues, text direction bugs
- Migration plan: Pin Ant Design to exact version (5.10.0). Test all updates in staging. Maintain fallback non-RTL version. Monitor Ant Design issues for RTL regressions

**MongoDB.Entities ORM Soft Delete Behavior:**
- Risk: Soft delete via `IsDeleted` flag not enforced at ORM level. Query filters must include `!IsDeleted` everywhere
- Impact: Queries returning deleted records. Data corruption possible if filters omitted
- Migration plan: Create repository base class enforcing soft delete filters. Add query analyzer to detect missing filters. Consider hard migration to entity versioning

**Corvus.Json.Validator License Compliance:**
- Risk: Corvus.Json.Validator open source license requires review before production use
- Impact: Potential licensing issue in commercial deployments
- Migration plan: Audit license compatibility. Consider alternative validators (Newtonsoft.JsonSchema, NJsonSchema). Document licensing in deployment docs

## Missing Critical Features

**Retry Logic for Output Destinations:**
- Problem: Failed output to one destination causes entire batch to be marked failed. No per-destination retry
- Blocks: Partial output scenarios (3/4 destinations succeeded). No graceful degradation
- Solution: Implement per-destination retry policy. Track destination-level success/failure separately. Publish partial output event

**Schema Evolution/Versioning:**
- Problem: Changing schema immediately breaks existing data processing. No version tracking
- Blocks: Safe schema updates without downtime. Cannot support multiple schema versions simultaneously
- Solution: Implement schema versioning with version field in documents. Add schema migration utilities. Support version negotiation between services

**Data Masking for PII:**
- Problem: No built-in PII detection or masking. Raw sensitive data stored in logs and cache
- Blocks: GDPR/privacy compliance. Cannot redact PII from error messages
- Solution: Implement data classification schema. Add masking rules for sensitive fields. Audit logging for PII access

**Audit Trail for Data Changes:**
- Problem: No audit log for schema/datasource modifications. Cannot track who changed what when
- Blocks: Compliance requirements. Cannot investigate data quality issues
- Solution: Implement audit entity model. Log all CRUD operations with user/timestamp. Create audit API endpoint

**Circuit Breaker Pattern:**
- Problem: No circuit breaker for external service calls (HTTP API Connector, S3, SFTP). Cascading failures possible
- Blocks: Resilience against failing external services. Retry storms
- Solution: Implement Polly resilience library. Add circuit breaker to each connector. Configure exponential backoff

## Test Coverage Gaps

**Connection Connector Type Coverage:**
- What's not tested: SFTP, S3, HTTP API, Kafka connectors only have unit stubs. No real integration tests
- Files: `src/Services/Shared/Connectors/SftpConnector.cs`, `S3Connector.cs`, `HttpApiConnector.cs`, `KafkaConnector.cs`
- Risk: Connection failures in production undetected. Credential rotation incompletely tested
- Priority: HIGH - Blocks operational reliability

**Format Converter Edge Cases:**
- What's not tested: Empty files, single-record files, special characters in values (quotes, newlines, null bytes), BOM handling in XML/CSV
- Files: `src/Services/Shared/Converters/*.cs`
- Risk: Data corruption in edge cases. Silent truncation or format errors
- Priority: MEDIUM - Blocks data quality verification

**Multi-Format Archive Processing:**
- What's not tested: TAR, RAR, 7Z archives. Only ZIP tested. Mixed format archives (ZIP containing TAR)
- Files: `src/Services/FileProcessorService/Consumers/FileDiscoveredEventConsumer.cs` (archive extraction logic)
- Risk: Archive format support claims unsupported in production
- Priority: MEDIUM - Blocks feature advertised in product

**Frontend Component Accessibility (a11y):**
- What's not tested: Screen reader compatibility, keyboard navigation, color contrast ratios
- Files: All React components in `src/Frontend/src/components/`
- Risk: Non-compliant with accessibility standards. Unusable for visually impaired users
- Priority: LOW but IMPORTANT - Compliance risk

**Error Recovery Scenarios:**
- What's not tested: Network timeout recovery, partial file uploads, pod restart during processing
- Files: `src/Services/*/Consumers/*.cs`, `src/Frontend/src/services/`
- Risk: Silent failures or inconsistent state recovery
- Priority: HIGH - Blocks production reliability

**Hebrew Localization Edge Cases:**
- What's not tested: RTL text mixing (Hebrew + English code), long text truncation in Hebrew, date format localization
- Files: `src/Frontend/src/locales/he/translation.json`, RTL layout components
- Risk: UI breaks for Hebrew users in certain scenarios. Unlocalized strings may appear in Hebrew UI
- Priority: MEDIUM - Blocks full localization support

---

*Concerns audit: 2026-01-28*
