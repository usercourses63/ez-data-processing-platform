# Phase 14: OTEL Verification - Research

**Researched:** 2026-02-25
**Domain:** OpenTelemetry observability verification (logs/traces/metrics) for .NET microservices
**Confidence:** HIGH

## Summary

Phase 14 requires building a verification tool that queries Elasticsearch (logs), Jaeger (traces), and Prometheus (metrics) to confirm all microservices emit telemetry signals, then fixing any gaps found. The existing codebase has a mature OTEL infrastructure: a shared `OpenTelemetryConfiguration.cs` that configures metrics/traces/logs export via OTLP gRPC, a `LoggingConfiguration.cs` with Serilog + optional Elasticsearch direct logging, and a `BusinessMetrics.cs` with 26 business metrics. All 8 deployed services call `AddDataProcessingOpenTelemetry()`, and 7 of 8 call `AddDataProcessingLogging()` (DataSourceManagement is the exception -- it uses basic console/debug logging instead of the shared Serilog setup).

The primary gap risk is not in code instrumentation (which is comprehensive) but in **Kubernetes deployment configuration**: only 4 of 8 deployed services have the `OpenTelemetry__OtlpEndpoint` environment variable set in their k8s deployment YAML, meaning the other 4 services will fall back to `localhost:4317` which resolves to nothing inside the cluster. The verification tool should be a PowerShell script that queries the three observability backends via their HTTP APIs (all accessible through the existing port-forward setup), prints a colored pass/fail matrix, and identifies exactly which services are missing which signals.

**Primary recommendation:** Build a PowerShell verification script in `tools/` that queries Elasticsearch `dataprocessing-logs*` index, Jaeger `/api/services` + `/api/traces`, and Prometheus `/api/v1/query` for each of the 8 deployed service names. Fix gaps by adding missing `OpenTelemetry__OtlpEndpoint` env vars to all deployment YAMLs and ensuring `AddDataProcessingLogging()` is called in DataSourceManagement.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Existence check only -- confirm signals exist, don't validate content/schema
- All 9 microservices checked equally, no prioritization
- Idle state check -- services just need to be running, no need to trigger file processing
- Per-service breakdown: each service gets pass/fail for logs, traces, and metrics (9 services x 3 signals = 27 checks)
- Terminal table output -- colored pass/fail matrix printed to terminal
- One-shot run, no persistence or history tracking
- Fix all gaps in this phase -- phase isn't done until all 9 services pass
- Full fix depth: config changes, code instrumentation, new ActivitySource spans, custom metrics -- whatever it takes
- Full deployment cycle in scope: fix code, rebuild image, load to minikube, redeploy, verify
- Batch approach: run verification, identify all gaps, fix all services, then re-verify everything
- Logs: at least one log entry from the service exists in Elasticsearch
- Traces: at least one trace/span from the service exists in Jaeger
- Metrics: at least one metric from the service exists in Prometheus (infrastructure or business)
- Verify end results only -- don't audit OTEL Collector config separately

### Claude's Discretion
- Tool form (PowerShell script, dotnet CLI tool, or bash script)
- Tool access model (port-forward only vs cluster-internal support)
- Run mode (one-shot vs rerunnable with history)
- Trace quality bar detail (whether to check for named spans vs any span)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OTEL-01 | Every microservice generates structured logs via OTEL collector to Elasticsearch | Verification via Elasticsearch `_search` API on `dataprocessing-logs*` index filtering by `resource.service.name`; gap fixes via deployment YAML OTLP endpoint env vars and `AddDataProcessingLogging()` |
| OTEL-02 | Every microservice generates distributed traces via OTEL collector to Jaeger | Verification via Jaeger HTTP API `/api/services` and `/api/traces?service=X`; gap fixes via deployment YAML OTLP endpoint env vars |
| OTEL-03 | Every microservice generates metrics via OTEL collector to Prometheus | Verification via Prometheus `/api/v1/query` with PromQL `{service_name="X"}` or `{job=~".*X.*"}`; gap fixes via deployment YAML OTLP endpoint env vars |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| OpenTelemetry | 1.14.0 | Core OTEL SDK | Configured in all services |
| OpenTelemetry.Exporter.OpenTelemetryProtocol | 1.14.0 | OTLP gRPC exporter to OTEL Collector | Configured in all services |
| OpenTelemetry.Instrumentation.AspNetCore | 1.14.0 | Auto-instrument HTTP server traces/metrics | Configured in all services |
| OpenTelemetry.Instrumentation.Http | 1.14.0 | Auto-instrument HTTP client traces/metrics | Configured in all services |
| OpenTelemetry.Instrumentation.Runtime | 1.14.0 | .NET runtime metrics | Configured in all services |
| Serilog | 4.3.0 | Structured logging | Used by 7/8 deployed services |
| Elastic.Serilog.Sinks | 9.0.0 | Direct Elasticsearch logging | Available but `EnableElasticsearchLogging` defaults to `false` |

### Infrastructure (Already Deployed)
| Component | Version | Purpose | Port (local) |
|-----------|---------|---------|--------------|
| OTEL Collector (contrib) | latest | Telemetry aggregation & routing | 4317 (gRPC), 4318 (HTTP) |
| Jaeger (all-in-one) | 1.64.0 | Distributed tracing backend | 16686 (UI/API) |
| Elasticsearch | 8.17.0 | Log & trace storage | 9200 |
| Prometheus System | 3.1.0 | System metrics (http_, process_, dotnet_) | 9090 |
| Prometheus Business | 3.1.0 | Business metrics (business_*) | 9091 |
| Fluent Bit | 3.2.2 | Infrastructure container log collection | N/A (DaemonSet) |

### No New Libraries Needed
This phase requires NO new NuGet packages or npm modules. All verification is done via HTTP API calls to existing infrastructure, which a PowerShell script handles natively with `Invoke-RestMethod`.

## Architecture Patterns

### Current OTEL Pipeline Architecture
```
.NET Services (OTLP gRPC :4317)
        |
        v
   OTEL Collector
   /      |       \
  v       v        v
Prometheus   Elasticsearch   Jaeger
(remote write)  (logs+traces)  (OTLP)
```

### Service Telemetry Configuration Pattern
Each service's Program.cs follows this pattern:
```csharp
var serviceName = "DataProcessing.{ServiceName}";
builder.Services.AddDataProcessingLogging(builder.Configuration, builder.Environment, serviceName);
builder.Services.AddDataProcessingOpenTelemetry(builder.Configuration, serviceName);
```

### Service Name Registry (CRITICAL for verification)
| Service | OTEL Service Name | K8s Deployment Name | Has Logging? | Has OTLP Env? |
|---------|-------------------|---------------------|--------------|---------------|
| DataSourceManagement | DataProcessing.DataSourceManagement | datasource-management | NO (console only) | NO |
| ValidationService | DataProcessing.Validation | validation | YES | YES |
| FileProcessorService | DataProcessing.FileProcessor | fileprocessor | YES | YES |
| FileDiscoveryService | DataProcessing.FileDiscovery | filediscovery | YES | YES |
| SchedulingService | DataProcessing.Scheduling | scheduling | YES | NO |
| OutputService | DataProcessing.Output | output | YES | YES |
| MetricsConfigurationService | DataProcessing.MetricsConfiguration | metrics-configuration | YES | NO |
| InvalidRecordsService | DataProcessing.InvalidRecords | invalidrecords | YES | NO |
| DataSourceChatService | DataProcessing.Chat | NONE (no deployment) | YES | NO |

### Verification Tool Architecture
```
tools/
  verify-otel.ps1          # Main verification script
```

The script should:
1. Query each observability backend via HTTP (port-forwarded endpoints)
2. Check for each service name across all 3 signal types
3. Print a colored terminal table with pass/fail per cell
4. Exit with non-zero code if any check fails

### Recommended Tool: PowerShell Script

**Why PowerShell over dotnet CLI tool:**
- Zero build step -- runs immediately
- `Invoke-RestMethod` handles JSON APIs natively
- `Write-Host -ForegroundColor` for colored terminal output
- Consistent with project's existing scripts (`start-port-forwards.ps1`)
- Single file, no project scaffolding
- Easy to re-run during gap fixing

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Elasticsearch querying | Custom HTTP client in C# | `Invoke-RestMethod` to ES `_search` API | One-line API call vs full project |
| Jaeger trace querying | gRPC client for Jaeger | Jaeger HTTP API `/api/services` + `/api/traces` | Undocumented but stable, used by Jaeger UI itself |
| Prometheus metric querying | PromQL library | Prometheus HTTP API `/api/v1/query` | Simple REST call |
| Terminal table formatting | Custom table renderer | PowerShell `Format-Table` with color via `Write-Host` | Built into PowerShell |

## Common Pitfalls

### Pitfall 1: Missing OTLP Endpoint in K8s Deployments
**What goes wrong:** Services have `AddDataProcessingOpenTelemetry()` in Program.cs and `"OtlpEndpoint": "http://localhost:4317"` in appsettings.json, but `localhost:4317` resolves to nothing inside a Kubernetes pod. The service silently drops all telemetry.
**Why it happens:** Only 4 of 8 deployment YAMLs include the `OpenTelemetry__OtlpEndpoint` environment variable pointing to `otel-collector:4317`.
**How to avoid:** Add `OpenTelemetry__OtlpEndpoint` env var (from configmap key `otlp-endpoint`) to ALL deployment YAMLs.
**Affected services:** datasource-management, scheduling, metrics-configuration, invalidrecords.

### Pitfall 2: DataSourceManagement Missing Serilog/Structured Logging
**What goes wrong:** DataSourceManagementService uses `builder.Services.AddLogging(loggingBuilder => { loggingBuilder.AddConsole(); loggingBuilder.AddDebug(); })` instead of `AddDataProcessingLogging()`. Logs go to stdout but NOT through the OTEL log pipeline.
**Why it happens:** This service was written earlier with a different pattern and never updated to use the shared logging configuration.
**How to avoid:** Replace the basic logging with `AddDataProcessingLogging()` call.
**Warning signs:** No logs from this service in Elasticsearch despite it being healthy.

### Pitfall 3: OTEL Log Pipeline vs Serilog Elasticsearch Sink Confusion
**What goes wrong:** The codebase has TWO paths for logs to reach Elasticsearch: (a) OTEL Collector logs pipeline (via `WithLogging()` in `OpenTelemetryConfiguration.cs`) and (b) Serilog Elasticsearch sink (via `LoggingConfiguration.cs` with `EnableElasticsearchLogging`). The Serilog sink defaults to `false`, so logs reach ES only via path (a) through the OTEL Collector.
**Why it matters:** The verification tool should check the OTEL-routed index (`dataprocessing-logs`) not the Serilog direct index (`logs-dataprocessing-*`). The OTEL Collector elasticsearch exporter uses ECS mapping mode and the `dataprocessing-logs` index.
**How to avoid:** Query `dataprocessing-logs*` index for verification. Don't enable the Serilog sink -- the OTEL path is the correct one.

### Pitfall 4: DataSourceChatService Has No K8s Deployment
**What goes wrong:** CONTEXT.md says "all 9 microservices" but DataSourceChatService has no Kubernetes deployment and is listed as "optional" in CLAUDE.md.
**Why it matters:** Cannot verify a service that isn't running. The verification tool should note this explicitly.
**How to avoid:** Either (a) exclude DataSourceChatService from the 9-service check and document it, or (b) deploy it first. Recommend option (a) -- verify the 8 deployed services, note ChatService as not-deployed/excluded. If the user expects all 9, deploying the ChatService is a prerequisite gap to fix.

### Pitfall 5: Prometheus Remote Write vs Scrape Confusion
**What goes wrong:** Metrics reach Prometheus via OTEL Collector's `prometheusremotewrite` exporter, NOT via traditional Prometheus scraping. The `resource_to_telemetry_conversion` setting in the collector config converts OTEL resource attributes to Prometheus labels.
**Why it matters:** Service identification in Prometheus will use the label `service_name` (converted from OTEL resource attribute `service.name`) rather than the traditional `job` label from scrape config. Verification queries must use the right label.
**How to avoid:** Query with `{service_name="DataProcessing.X"}` not `{job="X"}`.

### Pitfall 6: appsettings.Production.json Only Exists for 3 Services
**What goes wrong:** Only FileProcessor, FileDiscovery, and Output have `appsettings.Production.json` with the OTEL endpoint override. The other services rely entirely on the base `appsettings.json` which has `localhost:4317`.
**Why it matters:** Even if we add env vars to k8s deployments, services without Production json may have other gaps.
**How to avoid:** The env var `OpenTelemetry__OtlpEndpoint` overrides both appsettings files via .NET configuration hierarchy, so adding it to the deployment YAML is sufficient. No need to create Production json files for all services.

### Pitfall 7: Elasticsearch Index Names Vary By Source
**What goes wrong:** Multiple Elasticsearch index patterns exist:
- `dataprocessing-logs` -- OTEL Collector logs pipeline (what we want)
- `dataprocessing-traces` -- OTEL Collector traces pipeline
- `jaeger-*` -- Jaeger's own Elasticsearch storage for traces
- `ez-logs-*` -- Fluent Bit infrastructure container logs
- `logs-dataprocessing-*` -- Serilog Elasticsearch sink (if enabled)
**How to avoid:** For OTEL-01 verification, query `dataprocessing-logs*`. The service name field in ECS-mapped OTEL logs is typically `resource.service.name` or `Resource.service.name`.

## Code Examples

### Verification: Query Elasticsearch for Service Logs
```powershell
# Query Elasticsearch for logs from a specific service
# The OTEL Collector exports logs to "dataprocessing-logs" index with ECS mapping
$esUrl = "http://localhost:9200"
$serviceName = "DataProcessing.Validation"

$body = @{
    query = @{
        bool = @{
            should = @(
                @{ match = @{ "resource.service.name" = $serviceName } }
                @{ match = @{ "Resource.service.name" = $serviceName } }
                @{ match = @{ "service.name" = $serviceName } }
            )
            minimum_should_match = 1
        }
    }
    size = 1
} | ConvertTo-Json -Depth 10

$result = Invoke-RestMethod -Uri "$esUrl/dataprocessing-logs*/_search" -Method POST -Body $body -ContentType "application/json"
$hasLogs = $result.hits.total.value -gt 0
```

### Verification: Query Jaeger for Service Traces
```powershell
# Query Jaeger API for services and traces
$jaegerUrl = "http://localhost:16686"

# Step 1: Get list of all services reporting traces
$services = Invoke-RestMethod -Uri "$jaegerUrl/api/services"
# $services.data is an array of service names

# Step 2: Check if specific service has traces
$serviceName = "DataProcessing.Validation"
$hasService = $services.data -contains $serviceName

# Step 3: Optionally verify actual traces exist
if ($hasService) {
    $traces = Invoke-RestMethod -Uri "$jaegerUrl/api/traces?service=$serviceName&limit=1&lookback=1h"
    $hasTraces = $traces.data.Count -gt 0
}
```

### Verification: Query Prometheus for Service Metrics
```powershell
# Query Prometheus for metrics from a specific service
# Both System (9090) and Business (9091) Prometheus instances
$promSystemUrl = "http://localhost:9090"
$promBusinessUrl = "http://localhost:9091"
$serviceName = "DataProcessing.Validation"

# Check system metrics (http_, process_, dotnet_ prefixes via remote write from OTEL)
$query = [System.Uri]::EscapeDataString("{service_name=`"$serviceName`"}")
$systemResult = Invoke-RestMethod -Uri "$promSystemUrl/api/v1/query?query=$query"
$hasSystemMetrics = $systemResult.data.result.Count -gt 0

# Check business metrics
$businessResult = Invoke-RestMethod -Uri "$promBusinessUrl/api/v1/query?query=$query"
$hasBusinessMetrics = $businessResult.data.result.Count -gt 0

$hasMetrics = $hasSystemMetrics -or $hasBusinessMetrics
```

### Gap Fix: Add OTLP Endpoint to Deployment YAML
```yaml
# Add to env section of each deployment YAML that's missing it
- name: OpenTelemetry__OtlpEndpoint
  valueFrom:
    configMapKeyRef:
      name: services-config
      key: otlp-endpoint
```

### Gap Fix: Add Structured Logging to DataSourceManagement
```csharp
// Replace in DataSourceManagementService/Program.cs:
// BEFORE:
// services.AddLogging(loggingBuilder => {
//     loggingBuilder.AddConsole();
//     loggingBuilder.AddDebug();
// });

// AFTER:
services.AddDataProcessingLogging(configuration, builder.Environment, serviceName);
```

## State of the Art

| Aspect | Current State | Gap | Fix Required |
|--------|--------------|-----|--------------|
| OTEL SDK | v1.14.0 (current) | None | None |
| OTEL Collector Config | Full pipeline configured | None | None -- verify end results only |
| Prometheus Remote Write | Both instances have `--web.enable-remote-write-receiver` | None | None |
| Jaeger Storage | Elasticsearch backend configured | None | None |
| K8s OTLP Env Var | 4/8 services configured | 4 services missing | Add env var to 4 deployments |
| Serilog Structured Logging | 7/8 services use shared config | DataSourceManagement uses basic logging | Add `AddDataProcessingLogging()` |
| DataSourceChatService | No k8s deployment | Cannot verify if not running | Exclude from check or deploy |

## Identified Gaps (Pre-Verification)

These are gaps identifiable from code review alone. The verification tool may reveal additional runtime gaps.

### Definite Gaps (from code review)

| Gap | Service | Signal | Fix |
|-----|---------|--------|-----|
| Missing OTLP endpoint env var | datasource-management | All 3 | Add env var to deployment YAML |
| Missing OTLP endpoint env var | scheduling | All 3 | Add env var to deployment YAML |
| Missing OTLP endpoint env var | metrics-configuration | All 3 | Add env var to deployment YAML |
| Missing OTLP endpoint env var | invalidrecords | All 3 | Add env var to deployment YAML |
| Missing structured logging setup | datasource-management | Logs | Replace basic logging with `AddDataProcessingLogging()` |
| No k8s deployment | chat (DataSourceChatService) | All 3 | Exclude or deploy |

### Possible Gaps (need runtime verification)
- Services may have OTEL configured but collector pipeline may drop signals
- Elasticsearch index mapping may not match expected field names
- Prometheus label names from remote write may differ from expectations
- Services may need health endpoint hit to generate initial telemetry

## Open Questions

1. **DataSourceChatService inclusion**
   - What we know: CONTEXT.md says "9 microservices" but only 8 are deployed
   - What's unclear: Whether the user expects DataSourceChatService to be deployed and verified
   - Recommendation: Verify the 8 deployed services. Note ChatService as excluded. If user insists on 9, creating a deployment YAML is a prerequisite task

2. **Elasticsearch field name for service identification**
   - What we know: OTEL Collector uses ECS mapping mode for the elasticsearch exporter
   - What's unclear: Exact field path for service name in ECS-mapped OTEL logs (could be `resource.service.name`, `service.name`, or `Resource.attributes.service.name`)
   - Recommendation: The verification script should try multiple field names and report which one works. This is a runtime discovery task.

3. **Prometheus label name for service identification**
   - What we know: OTEL Collector uses `resource_to_telemetry_conversion: enabled` which converts resource attributes to labels
   - What's unclear: Whether the label is `service_name`, `service`, or `exported_service_name` in Prometheus
   - Recommendation: Query Prometheus `/api/v1/label/__name__/values` and inspect labels on a known metric first

## Sources

### Primary (HIGH confidence)
- `src/Services/Shared/Configuration/OpenTelemetryConfiguration.cs` -- full OTEL setup code
- `src/Services/Shared/Configuration/LoggingConfiguration.cs` -- Serilog + ES sink setup
- `src/Services/Shared/Monitoring/BusinessMetrics.cs` -- 26 business metrics definitions
- `k8s/deployments/otel-collector.yaml` -- OTEL Collector pipeline config
- `k8s/configmaps/services-config.yaml` -- cluster service configuration
- All 9 service `Program.cs` files -- verified instrumentation calls
- All k8s deployment YAMLs -- verified env var presence

### Secondary (MEDIUM confidence)
- [Jaeger APIs documentation](https://www.jaegertracing.io/docs/2.14/architecture/apis/) -- HTTP API endpoints
- [Prometheus HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/) -- query endpoints
- [Elasticsearch Search API](https://www.elastic.co/guide/en/elasticsearch/reference/8.19/getting-started.html) -- search endpoint syntax

### Tertiary (LOW confidence)
- Exact Elasticsearch field names for ECS-mapped OTEL logs -- needs runtime verification
- Exact Prometheus label names from OTEL remote write -- needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages, versions, and configs verified from source code
- Architecture: HIGH -- full pipeline traced from service code through collector to backends
- Gap identification: HIGH -- deployment YAML gaps are deterministic from code review
- Verification API details: MEDIUM -- Jaeger HTTP API is intentionally undocumented but widely used
- Elasticsearch/Prometheus field names: LOW -- depends on runtime behavior of ECS mapping and resource-to-telemetry conversion

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- infrastructure versions pinned)
