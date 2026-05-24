# Codebase Concerns

**Analysis Date:** 2026-05-24

## Working-Tree State (Repository Hygiene)

**Massive uncommitted deletion (1,498 deleted paths in working tree, 1 modified, 2 untracked):**
- Symptoms: `git status --short` shows 1,498 entries — almost every entry is `D` (working-tree delete). HEAD still has the files; the workspace does not. The repo is mid-cleanup but the deletion has never been staged or committed.
- Files: Entire trees under `_bmad/`, `_bmad-output/`, `_bmad/_config/`, `_bmad/_memory/`, `_bmad/bmm/`, `.taskorchestrator/config.yaml`, `.clinerules/general_rules.md`, `.planning/codebase/*.md`, `docs/troubleshooting/*.md`, `docs/testing/*.md`, `docs/user-guide/USER-GUIDE-HE.md`, `helm/ez-platform/**` (entire Helm chart), `k8s/configmaps/**`, `k8s/deployments/**`, `k8s/infrastructure/**`, `k8s/services/**`, `k8s/ingress/**`, `k8s/rbac/**`, `k8s/storage/**`, `k8s/network-policies.yaml`, `k8s/ocp-routes.yaml`, `k8s/deploy-all.sh`, `k8s/deploy-all.ps1`.
- Trigger: A repository-wide cleanup (BMAD agent framework, task-orchestrator, codebase docs, full Helm chart, full k8s manifest tree, troubleshooting docs) has been performed on disk but never staged. A `cleanup-repository.ps1` sits at repo root unused.
- Workaround: Either restore from HEAD (`git restore .`) or stage the deletes (`git add -A`) and commit. As-is, the next `git add` could accidentally sweep all 1,498 deletions into a single destructive commit.
- Risk: Anyone running `git add . && git commit` from CLAUDE.md's mandated workflow (`After completing any task: git add .`) will commit the mass deletion immediately, removing the entire Helm chart, entire `k8s/` deployment tree, and BMAD tooling from history.
- Impact: HIGH — `git add .` is the default workflow per CLAUDE.md.

**Untracked artifacts at repo root:**
- `ds.json` (untracked) — appears to be a debug dump of a datasource
- `invalid-records-page.png` (untracked) — likely a screenshot
- `bash.exe.stackdump` (committed; should not be) — crash dump
- `temp-traces.json`, `C:UsersUserCAppDataLocalTempfilediscovery.json`, `C:UsersUserCsourcereposEZtemp-traces.json` (committed; literal Windows path strings as filenames — likely stray copy-paste)
- `uat-22-01-landing.png` … `uat-22-07-after-30s.png` (committed) — UAT screenshots living at repo root rather than under `.planning/phases/22-*`
- Fix approach: Add to `.gitignore` and remove from tree; move screenshots under `.planning/phases/22-signalr-monitoring-data-integration/artifacts/`.

**Stale planning structure:**
- `.planning/codebase/` blobs still exist in HEAD but are all marked deleted on disk: `ARCHITECTURE.md`, `CONCERNS.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `PROJECT-CONTEXT.md`, `STACK.md`, `STRUCTURE.md`, `TESTING.md`. Existing `CONCERNS.md` (HEAD) is dated 2026-02-02 and references issues that have since been fixed.
- Fix approach: This re-mapping run replaces them. After re-write, commit the new docs together with the deletion of the obsolete versions.

---

## Tech Debt

**Existing TODO/FIXME comments — backend (sample, 7 items found):**

- `src/Services/DataSourceManagementService/Services/DataSourceService.cs:692` — `// TODO: Implement actual connection testing based on connection type` — `TestConnectionAsync` returns hardcoded `connectionStatus = "success"` with fake `latencyMs = 150`. Users cannot validate FTP/SFTP/S3/Kafka credentials before scheduling.
- `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs:454` — `// TODO: Publish AlertTriggeredEvent for downstream processing` — Alert thresholds evaluate but no event is published; no notifications can fire.
- `src/Services/MetricsConfigurationService/Services/Alerts/AlertEvaluationService.cs:85` — `// TODO: In future, integrate with NotificationService to send alerts`.
- `src/Services/OutputService/Consumers/ValidationCompletedEventConsumer.cs:221` — `// TODO: Publish OutputCompletedEvent for monitoring` — No downstream completion signal; monitoring cannot track end-to-end pipeline.
- `src/Services/ValidationService/DataProcessing.Validation.csproj:10` — `<!-- Suppress obsolete DataProcessingMetrics warning - TODO: Migrate to BusinessMetrics -->` — Two metric systems running in parallel (Prometheus-net vs OpenTelemetry BusinessMetrics).
- `src/Services/DataSourceManagementService.Tests/OptimisticLockingTests.cs:14, :23` — Both optimistic locking tests are TODO stubs; concurrency control is shipped but unit-tested only as placeholders.

**Existing TODO/FIXME comments — frontend (2 items found):**
- `src/Frontend/src/components/shared/ErrorBoundary.tsx:42` — `// TODO: Send to error tracking service (Sentry, etc.)` — caught React errors are logged to console only.
- `src/Frontend/src/components/metrics/VisualFormulaBuilder.tsx:126` — `// TODO: Fetch actual fields from schema API based on dataSourceId` — field list is hardcoded.

**Deprecated metrics class still in use (TD-01 from `.planning/research/PITFALLS.md`):**
- Issue: `DataProcessingMetrics` (Prometheus-net) marked `[Obsolete]` but still referenced; `BusinessMetrics` (OpenTelemetry, `src/Services/Shared/Monitoring/BusinessMetrics.cs`, 1246 lines) is the intended successor.
- Files: `src/Services/Shared/Monitoring/BusinessMetrics.cs`, `src/Services/Shared/Monitoring/DataProcessingMetrics.cs`, `.csproj` `<NoWarn>` lines suppress migration warnings.
- Impact: Duplicate metrics emitted to two Prometheus servers (system 9090, business 9091); dashboards may double-count. Migration warning is suppressed cluster-wide, so the deadline is invisible.
- Fix approach: Audit every `DataProcessingMetrics.*` call → replace with `BusinessMetrics`. Re-enable the warning. Update Grafana dashboards.

**SignalR `EntityChanged` broadcast not yet on every CRUD controller (MANDATORY per CLAUDE.md):**
- CLAUDE.md requires every CRUD controller to call `_hubContext.Clients.All.SendAsync("EntityChanged", …)`. Implemented on 4 controllers:
  - `src/Services/DataSourceManagementService/Controllers/DataSourceController.cs` (3 broadcasts)
  - `src/Services/DataSourceManagementService/Controllers/CategoriesController.cs` (5 broadcasts)
  - `src/Services/DataSourceManagementService/Controllers/ServersController.cs` (4 broadcasts)
  - `src/Services/DataSourceManagementService/Controllers/NasDevicesController.cs` (6 broadcasts)
- **Missing broadcasts on CRUD controllers with `[HttpPost]/[HttpPut]/[HttpDelete]`:**
  - `src/Services/DataSourceManagementService/Controllers/SchemaController.cs` — 8 mutating endpoints (POST, PUT, DELETE, publish, duplicate). Schema is `EntityType` consumed by validation; clients viewing schemas will not auto-refresh.
  - `src/Services/MetricsConfigurationService/Controllers/MetricController.cs` — 4 mutating endpoints (POST, PUT, DELETE, duplicate). Metric list page will not auto-refresh.
  - `src/Services/SchedulingService/Controllers/SchedulingController.cs` — 6 mutating endpoints (create, update, delete, pause, resume, trigger). Schedule status will not auto-refresh.
  - `src/Services/InvalidRecordsService/Controllers/InvalidRecordController.cs` — 9 mutating endpoints (status update, correct, reprocess, bulk operations). The Invalid Records page is one of the most write-heavy and will not auto-refresh.
  - `src/Services/MetricsConfigurationService/Controllers/GlobalAlertController.cs` — mutating endpoints not audited but follows same pattern.
- One non-controller broadcast exists at `src/Services/InvalidRecordsService/Services/RevalidationService.cs:151` (uses `EntityChanged` but only on auto-revalidation, not on manual CRUD).
- Impact: Multi-tab UX is silently inconsistent — users on Schemas/Metrics/Schedules/InvalidRecords pages must manually refresh after another tab modifies data. Hard to detect because the convention is described in CLAUDE.md but not enforced by lint/test.
- Fix approach: For each missing controller, inject `IHubContext<MonitoringHub>`, broadcast on every successful mutation, define `EntityType` strings ("Schema", "Metric", "Schedule", "InvalidRecord", "GlobalAlert"). Add a sanity test that grep-counts `EntityChanged` lines against mutating endpoint counts.

**Phase milestone tech debt (from `.planning/v0.2-MILESTONE-AUDIT.md`):**
- Phase 16 (SignalR realtime updates): TraceUpdate type mismatch was documented as a gap but is RESOLVED in current code (Array.isArray handler in `useMonitoringHub.ts`).
- Phase 16: `IKafkaMonitoringService` interface naming mismatch — actually implemented by `RabbitMqMonitoringService` (cosmetic). Files: `src/Services/DataSourceManagementService/Services/RabbitMqMonitoringService.cs`.
- Phase 18 (E2E validation): `pipeline-flow.spec.ts` referenced as broken in the audit, but verification confirms `waitForPipelineOutput` and `compareOutputWithInput` ARE now called (lines 201, 269 in `src/Frontend/tests/e2e/e2e-validation/pipeline-flow.spec.ts`). Audit doc is stale.
- Phase 20 (CI/CD production deployment): CI builds and validates Helm but image push is disabled (placeholder comment in `.github/workflows/ci.yml` line 156-170). `helm install/upgrade` never invoked in CI. Tag-triggered builds untested live.
- Phase 22 (SignalR monitoring data integration): `22-UAT.md` Test 1 marked `issue: severity major`. `KafkaMonitoringService.GetQueueStatusesAsync()` throws on `kafka:9092` DNS, and `RunInfrastructureBroadcastLoop` uses `Task.WhenAll` — one Kafka failure cancels all 6 infrastructure broadcasts (ServiceStatus, PodStatus, Metrics, ClusterInfo, Alert, Trace). DeviceHealthUpdate still works (separate loop). Files: `src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs`, `helm/ez-platform/templates/configmaps/services-config.yaml`. Fix: wrap each task independently so one failure doesn't kill the rest.
- Phase 26 (Completeness checklist): 8 gaps identified (`.planning/phases/26-completeness-checklist/26-VERIFICATION.md`) including D-11 schema validation only checking `type` presence (not full JSON-Schema-2020-12), D-13 borders missing for Select/Switch/DatePicker controls, D-18 missing fields not shown on sidebar card, D-29 DemoDataGenerator creates inconsistent demo data.
- Phase 32 (Performance regression hardening): 32-VERIFICATION.md shows truths 6, 7, 10 FAILED — frontend Provision/CRUD/pipeline tests were performed via API as Chrome MCP unavailable; D-11/D-12/D-14/D-17 require frontend-only validation. Three pieces of human verification still required.
- Unverified phases (12 of 33): 02, 06, 08, 10, 13, 15.1, 24, 27, 28, 29, 30, 31 completed without formal `*-VERIFICATION.md`.

**Hard-coded test credentials in test fixtures (not production but worth tracking):**
- `src/Frontend/tests/e2e/import-archive-api.spec.ts:146,167,178` — `password: 'test123'` in archive test fixtures.
- `src/Frontend/tests/e2e/protocols/s3.spec.ts` — references hardcoded test creds.
- Risk: Low — test scope only. Confirm these tests do not run against production endpoints.

---

## Known Bugs

**Recently-fixed regressions (track for re-occurrence patterns):**

**(1) Filediscovery NAS silent failure — dedup hash written before publish:**
- Resolved: 2026-03-27, commit `ca78391`
- Symptoms: FileDiscovery acked `FilePollingEvent` from RabbitMQ but never published `FileDiscoveredEvent`. 0 events emitted. "1 duplicate(s) skipped" in Hazelcast.
- Files: `src/Services/FileDiscoveryService/Consumers/FilePollingEventConsumer.cs` (lines 224-237 had `AddProcessedFileHashAsync` BEFORE the `Publish`), `src/Services/FileProcessorService/appsettings.Production.json` (log level was Warning).
- Trigger: First poll wrote hash to Hazelcast; if anything downstream failed (or Hazelcast pod restarted mid-publish) the file was permanently blocked for the 24h TTL.
- Compounding factors: (a) Production log level Warning suppressed all consumer Information logs — "silent failure" was actually "silent success" of a dedup skip; (b) Hazelcast StatefulSet restart during testing caused `ClientOfflineException` on in-flight messages.
- Fix: Move `AddProcessedFileHashAsync` to after successful `Publish`. Bump FileProcessor log to Information.
- Knowledge base entry: `.planning/debug/knowledge-base.md` and `.planning/debug/resolved/filediscovery-nas-silent-failure.md`.
- Lesson — fragility signal: **anywhere we cache state before confirming the side-effect succeeded is a potential silent-failure trap.** Audit other Hazelcast writes for this pattern.

**(2) Nginx proxy invalidrecords port regression 5006→5007:**
- Resolved: 2026-03-29, commit `481d2ee` (and earlier `9fb93d9`)
- Symptoms: Frontend → InvalidRecords API requests 502, invalid-records page fails to load.
- Files: Frontend Docker image baked `nginx.conf` with `proxy_pass http://invalidrecords:5006` but the K8s service exposes 5007. Source `nginx.conf` had been fixed earlier; the image was simply not rebuilt.
- Mitigation in same commit: New `scripts/validate-nginx-ports.sh` cross-references `nginx.conf proxy_pass` ports against Helm service definitions; `scripts/build-all-images.sh` now runs validation before any image build; new `SANITY-21` test verifies nginx proxy routes through frontend NodePort at deploy time.
- Lesson — fragility signal: **stale baked images masking source-tree fixes.** Pre-build validation is the right pattern; extend it to other ConfigMap/image consistency checks.

**(3) SignalR malformed JSON — NaN serialization:**
- Resolved: 2026-03-20 (file: `.planning/debug/signalr-malformed-json.md`)
- Symptoms: WebSocket disconnects with `SyntaxError: Expected ',' or '}' after property value in JSON at position 4117`. 429 reconnect storm on negotiate endpoint.
- Files: `src/Services/DataSourceManagementService/Services/PrometheusQueryService.cs` (lines 57-62 — `TotalThroughput` and `AvgLatency` assigned `double.NaN` from `QueryInstantAsync` when Prometheus has no data), `Program.cs:142` SignalR JsonSerializerOptions strict by default.
- Root cause: Three-layer compound — `double.TryParse("NaN")` succeeds, default `System.Text.Json` strict mode throws on NaN serialization, SignalR flushes partial buffer before exception, browser parses truncated JSON.
- Fix: `SanitizeDouble()` helper around all DTO assignments, `SafeCastToInt()` for NaN→int casts (previously undefined behavior), `double.IsFinite()` check in `QueryInstantAsync`.
- Lesson — fragility signal: **any new field added to a SignalR-broadcast DTO that comes from Prometheus needs NaN sanitization.** The fix is local to two helpers but the pattern must be applied to every new field.

**(4) Phase 22 KafkaMonitoringService Task.WhenAll cascade — STILL OPEN:**
- Status: `severity: major` in `.planning/phases/22-signalr-monitoring-data-integration/22-UAT.md`.
- Symptoms: System Monitoring page renders 6 tabs and SignalR connects (negotiate 200), but `ClusterHeader` never renders and skeletons remain after 15s.
- Files: `src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs` (uses `Task.WhenAll` for infra broadcast loop), `k8s/configmaps/services-config.yaml` (`kafka-server: "kafka:9092"`).
- Trigger: `KafkaMonitoringService.GetQueueStatusesAsync()` throws `Confluent.Kafka.KafkaException` (broker transport failure — Confluent's rdkafka library has its own DNS resolver that fails on bare `kafka` hostname even though `getent` resolves it in-pod). Single failure aborts all 6 broadcasts.
- Workaround: DeviceHealthUpdate still works (separate 5s loop).
- Fix approach: Wrap each monitoring service call independently — catch Kafka errors, return empty queue list, continue broadcasting K8s/Prometheus data. Optionally fix the kafka address (try `kafka-service:9092` or `kafka-0.kafka-service:9092`).

**OutOfMemoryException recovery patterns (recent fix history):**
- Commit `4112700` "fix(validation+sanity): OOM crash + SANITY-19 rate limit cleanup delay"
- Commit `3a55277` "fix(validation+rates): 4Gi memory limit + 11s cleanup delays SANITY-17/18"
- Validation service required a memory bump to 4Gi to handle test workloads. Workload pattern: validating files with many records can spike memory. Tracking signal: any unit increase in records-per-file or files-per-batch needs re-validation against the 4Gi limit.

---

## Security Considerations

**Infrastructure default credentials checked into Git:**
- `k8s/deployments/rabbitmq.yaml` — `RABBITMQ_DEFAULT_USER: "guest"`, `RABBITMQ_DEFAULT_PASS: "guest"` as plain env vars. RabbitMQ Management UI is exposed at `localhost:15672` after port-forward.
- `k8s/infrastructure/grafana-deployment.yaml` — admin password is `EZPlatform2025!Beta` (base64-encoded in `admin-password: RVpQbGF0Zm9ybTIwMjUhQmV0YQ==`). Comment explicitly says "For production, replace with externally managed secrets (e.g., Vault, sealed-secrets)" — this is acknowledged tech debt.
- `k8s/infrastructure/mongodb-statefulset.yaml` — MongoDB started with no auth (`--replSet rs0 --bind_ip_all` only). Connection string `mongodb://mongodb:27017/?directConnection=true` has no credentials. Inside the cluster, anyone with pod access can read/write any database.
- Risk: Anyone with cluster network access (or a misconfigured Service/NodePort) gets full DB/queue access.
- Current mitigation: NetworkPolicies in `k8s/network-policies.yaml` (default-deny-ingress, explicit allows for service-to-service) — but only for ingress, and only if applied. No egress policies, no auth in datastore itself.
- Fix approach: Move all default credentials to Kubernetes Secrets (or Vault). Enable MongoDB auth with `--auth`. Replace RabbitMQ `guest/guest` with a per-service user. Generate Grafana password at install time. Document the secret-rotation procedure.

**OCP `restricted-v2` security context partially applied:**
- CLAUDE.md mandates: `runAsNonRoot: true`, `runAsUser: 1000`, `runAsGroup: 1000`, `fsGroup: 1000`, `seccompProfile.type: RuntimeDefault`, container `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `capabilities.drop: [ALL]`.
- Spot check of `k8s/deployments/datasource-management-deployment.yaml`: has pod `runAsNonRoot`, `runAsUser 1000`, `fsGroup 1000`, `seccompProfile`, container `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`. **Missing:** `readOnlyRootFilesystem: true`.
- Spot check of `k8s/infrastructure/mongodb-statefulset.yaml`: pod has only `fsGroup: 999`, no `runAsNonRoot`, no `runAsUser`, no `seccompProfile`. Container has `allowPrivilegeEscalation: false` and capabilities drop. **Will fail OCP restricted-v2 admission.**
- Fix approach: Audit every deployment/statefulset against CLAUDE.md security context template. Add `readOnlyRootFilesystem: true` everywhere (mount tmpfs for paths that need write — `/tmp`, app log dirs). Phase 30 (OCP compliance) is unverified per audit; explicit `30-VERIFICATION.md` is missing.

**Image tags inconsistent / partially pinned:**
- CLAUDE.md mandates pinned versions (no `:latest`). Spot check of `k8s/deployments/`:
  - `ez-platform/datasource-management:v0.4.0-reval1`
  - `ez-platform/filediscovery:v0.3.0`
  - `ez-platform/fileprocessor:v0.4.0-import`
  - `ez-platform/invalidrecords:v0.4.0-reval2`
  - `ez-platform/validation:v0.3.0`
  - `ez-platform/scheduling:v0.3.0`
  - `ez-platform/output:v0.3.0`
  - `ez-platform/metrics-configuration:v0.3.0`
  - `ez-platform/frontend:v0.5.0`
  - `ez-platform/docusaurus:v0.5.0`
- Issue: 5 different version stems (v0.3.0, v0.4.0, v0.4.0-reval1, v0.4.0-reval2, v0.4.0-import, v0.5.0) live in the same deployment manifest set. After v0.5.0 release the older services were not bumped.
- `rabbitmq:3-management-alpine` — not pinned to a patch version (commit `c1f8509` "fix: align all image tags across k8s YAMLs, Helm values, and running cluster" started this cleanup but RabbitMQ slipped through). Fluent-bit (`3.2.2`), Jaeger (`1.64.0`), MongoDB (`mongo:8.0`), OTEL collector (`0.96.0`) are pinned to minor.
- Risk: Pulling `rabbitmq:3-management-alpine` at different times yields different builds; OCP `:latest`-style guards may reject.
- Fix approach: Pin `rabbitmq:3.13.7-management-alpine` (or whatever stable matches current behavior). Pin `mongo:8.0.x`. Tag-align all `ez-platform/*` images to a single release tag during release.

**Path traversal risk in archive extraction (still latent):**
- Files: `src/Services/Shared/Services/SharpCompressArchiveService.cs`, `src/Services/FileDiscoveryService/Services/SharpCompressArchiveService.cs` (duplicated implementation between Shared and FileDiscovery — see "Convention drift" below).
- Risk: Malicious archive with `../../../etc/passwd` entry could write outside extraction dir. PITFALLS.md SM-02 documents the pattern.
- Current mitigation: Unknown — needs explicit `Path.GetFullPath().StartsWith(extractionRoot + separator)` check audit.
- Fix approach: Audit both `SharpCompressArchiveService.cs` copies for zip-slip protection. Add a unit test with a crafted malicious zip.
- Test coverage: Only happy paths exercised. SM-02 detection guideline in `.planning/research/PITFALLS.md`.

**RBAC for NAS PV/PVC management uses ClusterRole:**
- Files: `k8s/rbac/nas-device-rbac.yaml`
- Issue: `datasource-management` runs with `serviceAccountName: nas-device-manager` which has a `ClusterRole` granting `persistentvolumes: [get, list, watch, create, update, patch, delete]` cluster-wide. PVs are cluster-scoped so this is technically necessary, but a compromise of the datasource-management pod gives blanket PV access across all namespaces on the cluster.
- Risk: Cross-namespace blast radius if the pod is compromised.
- Fix approach: Audit logging on PV operations is essential. Consider a dedicated CSI driver or operator pattern instead of in-process k8s client calls from a business-logic service. Long-term: split NAS provisioning into a separate operator with reduced footprint.

**SignalR hub authorization not enforced (per `.planning/research/PITFALLS.md` SM-01):**
- File: `src/Services/DataSourceManagementService/Hubs/MonitoringHub.cs` (path inferred from Program.cs `app.MapHub<MonitoringHub>("/hubs/monitoring")`).
- Risk: Any browser session reaching the hub URL can subscribe to all real-time data including EntityChanged for every datasource, metric, NAS device. No tenant isolation.
- Current mitigation: CORS `SetIsOriginAllowed` with known IPs + `AllowCredentials` (Program.cs).
- Fix approach: Add `[Authorize]` to the hub. Verify user has access to subscribed entities. This is moot until authentication is added — see Missing Critical Features.

**No application authentication / authorization layer:**
- Issue: No auth provider configured (no IdentityServer, no JWT validation, no SSO). API endpoints are open to anyone reaching the port.
- Risk: Production deployment is open-to-cluster. Anyone on the network with port-forward access has full admin.
- Fix approach: Out of scope for v0.5.x but is a v1.0 blocker. Track as `Missing Critical Features`.

---

## Performance Bottlenecks

**Hazelcast TTL tuned for testing, not production:**
- Config: `k8s/configmaps/services-config.yaml`:
  - `FileDiscovery__DeduplicationTTLHours: "1"` (testing value; comment recommends 4-24 for production)
  - `Hazelcast__CacheTTLHours: "1"`
  - `invalid-records-ttl-days: "4"`
- Hazelcast map config: `time-to-live-seconds: 300` (5 min), `max-idle-seconds: 180` (3 min), `max-size: 256MB per map` (per `k8s/infrastructure/hazelcast-statefulset.yaml`).
- File defaults: `src/Services/FileDiscoveryService/appsettings.json: DeduplicationTTLHours: 24` (correct), `appsettings.Development.json: 1`, `appsettings.Production.json: 24`. Live ConfigMap overrides Production back to 1.
- Problem: A 1-hour dedup TTL means files re-discovered after 1 hour will reprocess. For "discover once, process once" semantics, 24h matches the daily-import use case. Currently the ConfigMap overrides the per-service Production value, defeating per-environment config.
- Performance target (CLAUDE.md): cache hit rate >95%. With 5-minute TTL on `file-content` map and an empty pipeline, the cache misses on every restart — hit rate is unmeasured in `.planning/`.
- Fix approach: Promote ConfigMap value to 24h. Add Prometheus metric `business_cache_hit_rate` derived from existing counters; alert if it drops below 95%.

**Validation service memory wall:**
- Required: 4Gi memory limit (recent fix `3a55277`). Original limit was lower and OOM-killed during sanity tests.
- File: `k8s/deployments/validation-deployment.yaml`.
- Trigger: Sanity test workload — CSV with N records, schema validation in-flight. Exact threshold unknown.
- Fix approach: Document the workload size that requires 4Gi. Add an OOM guard / streaming validation path for files >threshold. Without this, doubling test data will OOM again silently.

**Performance targets in CLAUDE.md vs measured reality:**
- Target: <1s per 100-record CSV file. Actual: not measured against current code (only sanity tests run; no perf benchmark in `tests/`).
- Target: Service startup <5s. Actual: deployment `initialDelaySeconds: 30` on liveness probe suggests >15s startup tolerance.
- Target: P99 API latency <500ms. Actual: no P99 dashboard exists — Prometheus has the histograms (`business_processing_duration_seconds`) but no Grafana panel shows P99 vs target line.
- Fix approach: Add a perf-regression suite that runs the documented targets and fails CI on regression. Currently performance is target-aspirational, not enforced.

**Pipeline-flow E2E test infrastructure dependency (per Phase 18 verification):**
- File: `src/Frontend/tests/e2e/e2e-validation/pipeline-flow.spec.ts`
- Status: `waitForPipelineOutput` and `compareOutputWithInput` ARE called now (lines 201, 269) — earlier audit gap was resolved.
- Latent issue: Test relies on `DemoDataGenerator` seeding FTP/SFTP/NAS via file-simulator. In environments where Chrome MCP / file-simulator are unavailable (Phase 32), the test gracefully skips rather than failing — meaning CI may pass without ever running the pipeline end-to-end.
- Fix approach: Add an explicit "infrastructure_unavailable" status report so a CI dashboard distinguishes pass from skip.

---

## Fragile Areas

**MonitoringBroadcaster infrastructure loop (`Task.WhenAll` cascade):**
- Files: `src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs`
- Why fragile: Six independent monitoring calls (K8s services, K8s pods, Prometheus metrics, cluster info, alerts, traces, Kafka queue) are awaited via `Task.WhenAll`. Any single failure cancels the entire broadcast cycle. Phase 22 `22-UAT.md` Test 1 documents this — Confluent.Kafka throws and the user-facing dashboard goes blank.
- Safe modification: Wrap each task with a try/catch returning an empty/fallback DTO; log and continue. Then re-aggregate.
- Test coverage: No integration test simulating Kafka unreachable while K8s/Prometheus are healthy.

**Validation rule expression evaluator (string substitution):**
- Files: `src/Services/MetricsConfigurationService/Services/Alerts/AlertEvaluationService.cs:109-200`
- Why fragile: Naive `string.Replace` for variable substitution — `Replace("x", value)` will also rewrite an `x` inside `xyz`. Hardcoded comparison operators only; no `AND`/`OR`/`NOT`. No timeout — a malformed expression could in principle hang. No validation that all referenced variables exist before evaluation.
- Safe modification: Adopt a proper expression library (NLua, Sprache, NCalc). Validate variable names up-front. Add a 100ms timeout. Unit-test substring/missing-variable edge cases.
- Test coverage: Only `>`, `<`, `>=`, `<=` with non-substring variable names exercised.

**FileDiscovery dedup flow (now fixed but pattern remains):**
- Files: `src/Services/FileDiscoveryService/Consumers/FilePollingEventConsumer.cs` (after `ca78391`)
- Why fragile: The "write cache state before confirming downstream success" pattern was the silent-failure root cause. Audit other Hazelcast writes for the same anti-pattern.
- Safe modification: Always: (1) perform the side effect, (2) confirm it succeeded, (3) record the dedup/idempotency marker.

**Optimistic locking (Version field) not tested under contention:**
- Files: `src/Services/Shared/Entities/DataProcessingBaseEntity.cs` (Version field), `src/Services/DataSourceManagementService.Tests/OptimisticLockingTests.cs` (both tests are TODO stubs).
- Why fragile: Optimistic concurrency is implemented and the UI surfaces 409 conflicts (Phase 22 UAT Test 5 passes), but unit tests are placeholders. Any regression to the `If-Match: <version>` header handling or to MongoDB.Entities version increment would not be caught.
- Safe modification: Implement the two stub tests. Add an E2E test for concurrent edit from two browser sessions.

**SignalR DTO NaN serialization (defense-in-depth incomplete):**
- Files: `src/Services/DataSourceManagementService/Services/PrometheusQueryService.cs`
- Why fragile: Three-layer fix is in place (IsFinite check, SanitizeDouble helper, SafeCastToInt) but only for existing DashboardMetricsDto fields. **Any new field added to a SignalR DTO that sources from Prometheus must call SanitizeDouble.** No lint rule or convention enforces this.
- Safe modification: Wrap the DTO at construction time, not at field assignment. Add a unit test that serializes a DTO with NaN inputs through `System.Text.Json` to fail-fast.

**Large monolithic files (refactor candidates):**
- `src/Services/Shared/Monitoring/BusinessMetrics.cs` — 1,246 lines (single class)
- `src/Services/DataSourceManagementService/Services/DataSourceService.cs` — 1,197 lines
- `src/Frontend/src/pages/alerts/AlertsManagement.tsx` — 1,540 lines
- `src/Frontend/src/components/schema/RegexHelperDialog.tsx` — 1,122 lines
- `src/Frontend/src/pages/invalid-records/InvalidRecordsManagement.tsx` — 1,000 lines
- Why fragile: Single-file complexity makes changes risky and tests hard to scope. AlertsManagement.tsx and DataSourceService.cs are also where most TODOs live.
- Safe modification: Extract sub-services / sub-components incrementally; add unit-test coverage before splitting.

---

## Convention Drift Across Services

**Duplicate `SharpCompressArchiveService` implementations:**
- `src/Services/Shared/Services/SharpCompressArchiveService.cs`
- `src/Services/FileDiscoveryService/Services/SharpCompressArchiveService.cs`
- `src/Services/Shared/Services/HazelcastArchiveCacheService.cs`
- `src/Services/FileDiscoveryService/Services/HazelcastArchiveCacheService.cs`
- Issue: Same logic exists in two places. Bug-fix in one branch is silently un-fixed in the other.
- Fix: Move to `Shared` and delete the FileDiscovery copy.

**Activity source naming inconsistency:**
- `src/Services/Shared/Services/NasResourceService.cs:25` — `new ActivitySource("DataProcessing.NasResourceService", "1.0.0")`
- Other services use `DataProcessing.Platform`, `DataProcessing.Consumer`, `DataProcessing.Validation`, `DataProcessing.FileProcessor` (per `OpenTelemetryConfiguration.cs` registrations cited in `.planning/research/PITFALLS.md` CP-03).
- Risk: Activity sources not registered with `AddSource(...)` in OTel pipeline emit no traces. NasResourceService traces may be invisible in Jaeger.
- Fix: Either rename to a registered pattern (`DataProcessing.NasResource`) or add `AddSource("DataProcessing.NasResourceService")` to OTel config.

**Kafka vs RabbitMQ transport split:**
- Per `.planning/debug/resolved/filediscovery-nas-silent-failure.md`: MassTransit Kafka rider covers `FilePollingEvent`, `ValidationRequestEvent`, `ValidationCompletedEvent`, `FileProcessingFailedEvent`. But `FileDiscoveredEvent` uses RabbitMQ.
- Issue: The pipeline visibly mixes brokers. RabbitMQ queue depth is authoritative for `FileDiscoveredEvent`; Kafka offsets are authoritative for the others. Monitoring tooling and ops procedures must know which is which.
- Fix: Document the split explicitly in ARCHITECTURE.md. Pick a long-term direction (the v0.2 audit hints Kafka is preferred).

**KafkaMonitoringService interface naming mismatch:**
- Interface: `IKafkaMonitoringService`
- Implementation: `RabbitMqMonitoringService` (per `v0.2-MILESTONE-AUDIT.md` line 25)
- Cosmetic but misleading — flagged in audit as tech debt.

**Mixed file size suggests inconsistent decomposition standards:**
- Frontend files average ~200-400 lines; backend services average 200-500 lines. But several files break 1000 lines (see Fragile Areas). No team-wide guideline on max file size.

---

## Scaling Limits

**Validation service memory ceiling at 4Gi:**
- File: `k8s/deployments/validation-deployment.yaml`
- Current: 4Gi limit (recent bump). OOM-killed below this on current sanity workload.
- Limit: Unknown number of records per file before OOM at 4Gi.
- Scaling path: Implement streaming validation (do not buffer full file in memory). Add a `MaxRecordsPerFile` guard returning a controlled rejection rather than OOM.

**Hazelcast single-node, 256MB per map:**
- File: `k8s/infrastructure/hazelcast-statefulset.yaml`
- Current: 1 replica, 256MB heap for `file-content` map and 256MB for `valid-records`. `backup-count: 0` (no backups, single-node dev).
- Limit: Cache thrash if concurrent files exceed 256MB. Total cache loss on pod restart.
- Scaling path: Multi-node Hazelcast cluster with `backup-count: 1`; or replace with Redis cluster for >GB capacity. PITFALLS.md MP-01 covers SignalR Redis backplane configuration if Redis is introduced.

**MongoDB single replica:**
- File: `k8s/infrastructure/mongodb-statefulset.yaml` — `replicas: 1` despite "3-node Replica Set" being claimed in CLAUDE.md.
- Connection: `mongodb://mongodb:27017/?directConnection=true` — `directConnection=true` bypasses replica set semantics.
- Limit: Single point of failure; no HA. Backup/restore not documented.
- Scaling path: Bump to 3 replicas, enable replica set, remove `directConnection=true`. Document failover.

**FileDiscovery polling is per-schedule, not parallel:**
- File: `src/Services/FileDiscoveryService/Consumers/FilePollingEventConsumer.cs`
- Limit: Discovery for a single data source serializes through one consumer call. A datasource with 10k files where each poll runs >60min and the schedule is hourly will back up.
- Scaling path: Per-source concurrency limit + per-source worker pool.

**E2E test scope ceiling (per CLAUDE.md "Known Test Gaps"):**
- Only CSV fully tested. XML, Excel, JSON not E2E-covered.
- Max 100 records per file tested. No 10k-record runs.
- Only 2 output destinations exercised. 4+ destinations untested.
- Risk: Production-scale workload behavior is unproven.
- Fix approach: Define a quarterly perf-regression run with 10k-record CSV, multi-format files, 4-destination output. Block release if it regresses.

---

## Dependencies at Risk

**Image not pinned to patch version:**
- `rabbitmq:3-management-alpine` (in `k8s/deployments/rabbitmq.yaml`). Other infra is pinned (`mongo:8.0`, `jaegertracing/all-in-one:1.64.0`, `otel/opentelemetry-collector-contrib:0.96.0`, `fluent/fluent-bit:3.2.2`).
- Fix: Pin to `rabbitmq:3.13.7-management-alpine` (or the actually-tested version).

**Corvus.Json.Validator (4.3.9) — newer library, smaller community than Newtonsoft:**
- File: `Directory.Packages.props:15`
- Risk: JSON-Schema-2020-12 edge cases (deferred resolution, unevaluated properties) may surprise. Used as primary validator in `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs`.
- Fix: Keep `Newtonsoft.Json.Schema 4.0.1` (also declared in `Directory.Packages.props:12`) available as fallback. Add a validator-agreement test that runs both implementations on a fixture and asserts equivalent outcomes.

**SharpCompress (0.38.0):**
- File: `Directory.Packages.props:35`
- Risk: Smaller community than DotNetZip; security advisories slower. Already implicated in path-traversal concern.
- Fix: Subscribe to release notes; pin major.

**MongoDB.Entities (24.1.1) — abstracts MongoDB.Driver:**
- File: `Directory.Packages.props:18`
- Risk: LINQ-to-MongoDB translation bugs may silently mis-translate queries; Version-based optimistic concurrency relies on the abstraction working correctly.
- Fix: Add integration tests that assert generated queries match expectations on critical paths.

**Hazelcast.Net (5.5.1) is pinned** (previous CONCERNS.md claimed it was floating — that is no longer true; `Directory.Packages.props:19` pins it).

---

## Missing Critical Features

**No application authentication / authorization:**
- Problem: No login, no JWT, no user identity. SignalR hubs are open. API endpoints are open. RBAC for "who can edit which datasource" does not exist.
- Blocks: Multi-user production deployment; tenant isolation; audit trail of "who changed what".
- Priority: BLOCKER for v1.0.

**No real connection testing:**
- File: `src/Services/DataSourceManagementService/Services/DataSourceService.cs:692`
- Problem: `TestConnectionAsync` returns a hardcoded success with fake latency.
- Blocks: Users cannot validate FTP/SFTP/S3/Kafka credentials before scheduling. Failed connections only surface during processing.
- Priority: HIGH.

**No alert notifications:**
- Files: `src/Services/MetricsConfigurationService/Services/Alerts/AlertEvaluationService.cs:85`, `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs:454`
- Problem: Alert rules evaluate but never publish `AlertTriggeredEvent` or notify users (no email, Slack, webhook integration).
- Blocks: Monitoring is observation-only — operators have no out-of-band signal.
- Priority: HIGH.

**No `OutputCompletedEvent` published:**
- File: `src/Services/OutputService/Consumers/ValidationCompletedEventConsumer.cs:221`
- Problem: Pipeline does not emit a "done" signal.
- Blocks: Downstream automation cannot react. Monitoring cannot compute true end-to-end latency.
- Priority: MEDIUM.

**Tag-triggered CI deployment incomplete:**
- File: `.github/workflows/ci.yml` (line 156-170 per Phase 20 VERIFICATION.md)
- Problem: Image push is disabled. No `helm install/upgrade` step.
- Blocks: True CI/CD — release tags do not deploy.
- Priority: HIGH (claimed as part of v0.2 milestone but unverified).

**Backend unit tests largely absent:**
- Files found: only `src/Services/DataSourceManagementService.Tests/` (with TODO-only `OptimisticLockingTests.cs`) and `src/Services/FileProcessorService.Tests/`. No `.Tests.csproj` for Validation, Output, Scheduling, FileDiscovery, InvalidRecords, MetricsConfiguration, Shared.
- Blocks: Confidence in refactoring; regression-free convention enforcement.
- Priority: MEDIUM.

---

## Test Coverage Gaps

**Format coverage:**
- File: `src/Services/ValidationService/Consumers/ValidationRequestEventConsumer.cs`, `src/Services/Shared/Converters/`
- What's not tested: XML, JSON, Excel, Parquet validation in E2E. Per CLAUDE.md "Known Test Gaps": "Only CSV fully tested."
- Risk: Format-specific bugs (XML namespace handling, JSON nested arrays, Excel multi-sheet, Parquet column types) fail silently in production.
- Priority: HIGH.

**Load coverage:**
- What's not tested: >100 records, >1MB files, >2 concurrent files.
- Risk: Memory leaks, deadlocks, OOMs at production scale (4Gi validation limit was tripped at unknown record count).
- Priority: HIGH.

**Destination scaling:**
- File: `src/Services/OutputService/Consumers/ValidationCompletedEventConsumer.cs`
- What's not tested: >2 output destinations from one validated file. CLAUDE.md notes "Only 2 destinations tested."
- Risk: Race conditions or partial-output cascades if one destination fails.
- Priority: MEDIUM.

**Optimistic locking concurrency:**
- File: `src/Services/DataSourceManagementService.Tests/OptimisticLockingTests.cs:14, :23` — both tests are TODO stubs.
- Risk: 409 conflict handling regression goes undetected.
- Priority: MEDIUM.

**Path-traversal / zip-slip in archive extraction:**
- Files: `src/Services/Shared/Services/SharpCompressArchiveService.cs`, `src/Services/FileDiscoveryService/Services/SharpCompressArchiveService.cs`
- What's not tested: Malicious archive entries with `..` paths; nested archives; password-protected archives with wrong password; corrupted archives.
- Risk: Security vulnerability + service crash on malformed input.
- Priority: HIGH (security-relevant).

**Hazelcast failure modes:**
- Files: `k8s/infrastructure/hazelcast-statefulset.yaml`, every consumer that touches Hazelcast
- What's not tested: Hazelcast pod crash mid-pipeline; cache loss; reconnection (`ClientOfflineException` was the actual trigger of the Phase 22 / FileDiscovery debugging session).
- Risk: Single point of failure; processes hang waiting for cache.
- Priority: MEDIUM.

**`EntityChanged` SignalR convention enforcement:**
- What's not tested: That every mutating endpoint broadcasts.
- Risk: New CRUD controllers silently skip the convention. Already 4 controllers are missing broadcasts (Schema, Metric, Schedule, InvalidRecord).
- Priority: MEDIUM.

**Phases without `*-VERIFICATION.md` (12 of 33):**
- 02, 06, 08, 10, 13, 15.1, 24, 27, 28, 29, 30, 31.
- Risk: Features shipped without formal acceptance; regressions go unnoticed.
- Priority: MEDIUM (process gap rather than code gap).

---

*Concerns audit: 2026-05-24*
