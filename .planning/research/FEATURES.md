# Feature Landscape

**Domain:** Data Processing Platform - v0.2.0 Production Validation
**Researched:** 2026-02-11
**Confidence:** MEDIUM (existing codebase verified, industry patterns from web search)

---

## Executive Summary

This research maps five feature domains for the v0.2.0 release:

1. **Real-time System Monitoring with SignalR** - Replacing mock data with live OTEL metrics
2. **File Access Device Health Monitoring** - Latency, keep-alive, and connectivity tracking
3. **DemoDataGenerator Simulator Integration** - Auto-discovery of file-simulator devices
4. **Archive File Handling/Extraction** - Cross-protocol archive support (already partially implemented)
5. **NAS Device Selection in Data Source Forms** - Already implemented in ConnectionTab

The analysis categorizes each feature by Table Stakes (must-have), Differentiators (value-add), and Anti-Features (do not build).

---

## Feature Domain 1: Real-Time System Monitoring with SignalR

### Context

The existing `SystemMonitoring.tsx` page uses **mock data generators** that create simulated metrics. Production validation requires replacing these with real data from:
- OTEL Collector (traces, logs, metrics)
- Prometheus (business metrics at :9091, system metrics at :9090)
- Jaeger (distributed traces at :16686)
- Kubernetes API (pod status, events)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Service Health Grid - Real Data | Users expect to see actual service status | Medium | Replace `generateServiceStatuses()` with Prometheus queries |
| Metrics Overview Cards - Live Data | Dashboard KPIs must reflect reality | Medium | Query `business_*` metrics from Prometheus |
| Pod Status Table - K8s Integration | Admins need real container status | Low | Use K8s API via backend proxy |
| Pipeline Event Stream - Real Logs | Operators need actual event visibility | Medium | Stream from Elasticsearch `dataprocessing-logs` index |
| Auto-Refresh Indicator | Users need to know data freshness | Low | Already has `lastUpdate` state, ensure accuracy |
| Connection Status Banner | Users must know if real-time connection is active | Low | SignalR connection state indicator |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| SignalR Real-Time Push | Sub-second updates without polling (push vs 30s poll) | Medium | Replace `setInterval` with SignalR subscriptions |
| Distributed Trace Visualization | Click through request flows across services | High | Parse Jaeger spans, build visual flow |
| Custom Time Range Selection | Historical analysis (last hour/day/week) | Medium | PromQL time range parameters |
| Alert Integration | Live alert badges on service cards | Low | Subscribe to AlertManager webhooks |
| Latency Percentile Charts | P50/P90/P99 visualization | Low | `business_processing_duration_seconds` histogram |
| Queue Depth Trending | Predict backlog issues before they impact | Low | `business_files_pending` gauge with trend line |
| Dark/Light Mode Toggle | Professional appearance options | Low | Already has CSS infrastructure |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time CPU/Memory from Frontend | Security risk, K8s API exposure | Backend aggregates, SignalR pushes |
| Direct Prometheus Query from Browser | CORS issues, credential exposure | Backend proxy at `/api/monitoring/metrics` |
| Unlimited Historical Data | Performance, storage bloat | Cap at 7 days, sample older data |
| Per-Record Event Streaming | Overwhelming at scale (3000 records/sec) | Aggregate by service/minute |
| Auto-Refresh < 5 seconds | Server load, network traffic | Default 10-30 seconds, SignalR for alerts only |

### Implementation Notes

**SignalR Best Practices (from [Real-Time Analytics with SignalR](https://developersvoice.com/blog/data-analytics/real-time-analytics-with-influxdb/)):**
- Keep messages lightweight using compact JSON
- Throttle high-frequency events (batch metrics updates)
- Use Redis backplane for horizontal scaling
- Log connection/disconnection for observability

**Existing Mock Data Location:**
- `src/Frontend/src/services/monitoring-mock-data.ts`
- `src/Frontend/src/services/kubernetes-mock-data.ts`

**Replacement Pattern:**
```typescript
// Current (mock)
const newServices = generateServiceStatuses();

// Target (real)
signalRConnection.on("ServiceStatusUpdate", (statuses) => {
  setServices(statuses);
});
```

---

## Feature Domain 2: File Access Device Health Monitoring

### Context

Production systems need visibility into file access device connectivity across:
- NAS devices (7 servers in file-simulator topology)
- FTP/SFTP servers
- S3 endpoints
- HTTP endpoints

This differs from service health (which monitors EZ Platform microservices).

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Device Online/Offline Status | Operators need to know if sources are reachable | Low | Periodic connectivity test results |
| Last Successful Connection Time | Diagnosis of intermittent issues | Low | Timestamp from `LastConnectionTest` in NasDevice entity |
| Connection Error Messages | Actionable troubleshooting info | Low | `LastConnectionError` field exists |
| Health Status in Device Lists | Quick visual scan of fleet health | Low | Color-coded badges (green/yellow/red) |
| Manual Connection Test Button | On-demand verification | Low | Already exists: "Test Connection" button |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Latency Measurement per Device | Performance trending, SLA compliance | Medium | Measure round-trip time during health check |
| Historical Latency Chart | Detect degradation patterns | Medium | Store samples in time-series (MongoDB TTL or Prometheus) |
| Keep-Alive Background Service | Proactive detection vs reactive discovery | Medium | Background job every 30-60 seconds |
| Alerting on Threshold Breach | Notify before users notice | Medium | Latency > 500ms or 3 consecutive failures |
| SignalR Real-Time Health Push | Instant visibility of device state changes | Medium | Leverage file-simulator's `ServerStatusHub` pattern |
| Device Group Health Aggregation | "All input NAS healthy" summary | Low | Aggregate by Role (Input/Output/Backup) |
| Automatic Failover Notification | If primary unavailable, suggest alternate | High | Requires device redundancy mapping |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| High-Frequency Polling (< 10 sec) | Network overhead, rate limiting | 30-60 second intervals default |
| Store Unlimited Health History | Storage bloat | 7-day retention with 1-hour rollups |
| Auto-Disable Unhealthy Devices | Dangerous automation | Alert only, human decides |
| Expose Device Credentials in Health UI | Security risk | Show only masked/partial info |

### Implementation Notes

**Health Check vs Keep-Alive Distinction ([Health Checking Best Practices](https://carlmastrangelo.com/blog/health-checking-best-practices)):**
- **Health check**: Can the service handle requests? (System-wide)
- **Keep-alive**: Is this specific connection still valid? (Connection-scoped)
- **Recommendation**: Implement both - health check for dashboard, keep-alive for active connections

**Existing Entity Fields:**
```csharp
// NasDevice.cs already has:
public DateTime? LastConnectionTest { get; set; }
public bool? LastConnectionSuccess { get; set; }
public string? LastConnectionError { get; set; }
```

**New Fields Needed:**
```csharp
public int? LastLatencyMs { get; set; }
public DateTime? LastKeepAliveAt { get; set; }
public int ConsecutiveFailures { get; set; }
```

---

## Feature Domain 3: DemoDataGenerator Simulator Integration

### Context

The file-simulator at `C:\Users\UserC\source\repos\file-simulator-suite` provides:
- REST API at `:30500` for server discovery
- 7 NAS servers + FTP/SFTP/S3/HTTP/Kafka simulators
- SignalR hubs for real-time status

DemoDataGenerator should auto-discover these servers rather than hardcoding them.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| API-Driven Server Discovery | No manual configuration of demo servers | Low | Call `GET /api/servers` to list available |
| Auto-Create NasDevice Records | Populate database from simulator | Low | Map `DiscoveredServer` to `NasDevice` entity |
| Auto-Create AdminServer Records | Populate FTP/SFTP/S3/HTTP servers | Low | Existing `AdminServerGenerator.cs` pattern |
| Idempotent Generation | Running twice doesn't duplicate | Low | Check by Name before insert |
| Connection Info Extraction | Get credentials from simulator | Low | `GET /api/connection-info?format=dotnet` |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-Time Sync Mode | Keep demo data in sync with simulator | Medium | Subscribe to ServerStatusHub changes |
| Generate Test Files | Pre-populate input directories | Medium | Use simulator's `/api/files/upload` |
| Protocol-Specific Test Cases | Create datasources for each protocol | Low | Loop through discovered protocols |
| Health Verification Before Create | Only add healthy devices | Low | Check `PodReady` in `DiscoveredServer` |
| Cleanup Mode | Remove demo data cleanly | Low | Delete by `CreatedBy = "DemoGenerator"` |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-Delete Existing Data | Dangerous, could wipe production | Require explicit `--reset` flag |
| Hardcode Credentials | Security, maintainability | Read from simulator API or secrets |
| Assume Simulator Always Available | Generator should work standalone | Fallback to static config if API unreachable |

### Implementation Notes

**File-Simulator API Endpoints:**
```
GET /api/servers              - List all servers
GET /api/connection-info      - Get connection details (JSON/env/dotnet)
GET /api/servers/{name}       - Get specific server
GET /api/health               - Health check
```

**DiscoveredServer Model (from file-simulator):**
```csharp
public record DiscoveredServer {
    public string Name { get; init; }
    public string Protocol { get; init; }  // "ftp", "sftp", "nas", etc.
    public string ClusterIp { get; init; }
    public int Port { get; init; }
    public int? NodePort { get; init; }
    public bool PodReady { get; init; }
    public string? Directory { get; init; }
    public ServerCredentials? Credentials { get; init; }
}
```

**Mapping to EZ Platform:**
| Simulator Protocol | EZ Platform Entity | Direction |
|--------------------|-------------------|-----------|
| `nas` | `NasDevice` | Based on Directory |
| `ftp` | `AdminServer` (ServerType=ftp) | Based on Directory |
| `sftp` | `AdminServer` (ServerType=sftp) | Based on Directory |
| `s3` | `AdminServer` (ServerType=s3) | Both |
| `http` | `AdminServer` (ServerType=http) | Based on Directory |
| `kafka` | `AdminServer` (ServerType=kafka) | Both |

---

## Feature Domain 4: Archive File Handling/Extraction

### Context

Archive extraction is **already substantially implemented**:
- `IArchiveService` interface with full API
- `SharpCompressArchiveService` implementation (ZIP, TAR.GZ, RAR, 7Z)
- `ArchiveSettings` class for datasource configuration
- `ArchiveSettingsSection.tsx` UI component
- Security settings (zip bomb protection, path traversal prevention)

What may be missing: Cross-protocol archive handling specifics.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| ZIP Extraction | Most common format | **DONE** | SharpCompress implementation |
| TAR.GZ Extraction | Linux/Unix standard | **DONE** | SharpCompress implementation |
| RAR Extraction | Legacy format support | **DONE** | SharpCompress implementation |
| 7Z Extraction | High compression format | **DONE** | SharpCompress implementation |
| Password-Protected Archives | Enterprise compliance | **DONE** | `ArchivePassword` field exists |
| Nested Archive Support | Archives within archives | **DONE** | `ProcessNestedArchives` setting |
| Security Limits | Zip bomb protection | **DONE** | `ArchiveSecuritySettings` class |

### Differentiators (Cross-Protocol)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Archive-in-SFTP Extraction | Extract before pulling entire archive | High | Stream extraction requires SFTP range reads |
| Archive-in-S3 Extraction | Efficient processing without full download | High | S3 SelectObjectContent or range requests |
| Cached Extraction Results | Avoid re-extraction on reprocess | Medium | `HazelcastArchiveCacheService` exists |
| Progress Reporting | UX for large archives | Low | Emit events during extraction |
| Archive Content Preview | List files before extraction | Low | `ListContentsAsync` already exists |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Server-Side Remote Extraction | SFTP/FTP servers may not have tools | Always extract on EZ Platform side |
| Unlimited Archive Size | Memory exhaustion | Enforce `MaxArchiveSizeBytes` (512MB default) |
| Auto-Extract All Archives | May not be desired for all datasources | Require `IsArchiveSource` toggle |

### Implementation Notes

**Already Implemented:**
- `src/Services/Shared/Services/IArchiveService.cs` - Full interface
- `src/Services/Shared/Services/SharpCompressArchiveService.cs` - Implementation
- `src/Services/FileDiscoveryService/Consumers/FilePollingEventConsumer.cs` - Integration point
- `src/Frontend/src/components/datasource/tabs/sections/ArchiveSettingsSection.tsx` - UI

**Cross-Protocol Pattern ([CrossFTP](https://www.crossftp.com/)):**
Archive operations should:
1. Download archive from remote (FTP/SFTP/S3/HTTP/NAS)
2. Extract locally using SharpCompress
3. Process extracted files through normal pipeline
4. Clean up temporary extraction directory

---

## Feature Domain 5: NAS Device Selection in Data Source Forms

### Context

This feature is **already implemented** in v0.2.0:
- `ConnectionTab.tsx` has NAS device dropdown
- `NasDevice` entity with full schema
- K8s PV/PVC provisioning support
- Role-based filtering (Input/Output/Both)

### Table Stakes (All Implemented)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| NAS Protocol Option in Dropdown | Select NAS as connection type | **DONE** | Line 201-206 in ConnectionTab.tsx |
| Device Selector Dropdown | Choose from admin-configured devices | **DONE** | Lines 251-319 with health status |
| Mount Status Indication | Know if device is provisioned | **DONE** | `IsPvCreated && IsPvcBound` check |
| Sub-Path Configuration | Navigate within NAS export | **DONE** | `nasSubPath` field |
| Computed Mount Path Display | Show full path for clarity | **DONE** | Alert component at line 462-472 |

### Differentiators (Minor Enhancements)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| NAS Selection in OutputTab | Complete symmetry with input | Medium | OutputTab still uses `nfs` type string |
| Device Health Badge | Real-time status in dropdown | Low | Add LastConnectionSuccess indicator |
| Quick Provision Button | Provision unmounted device inline | Medium | Call provisioning API from form |
| Storage Quota Display | Show available space | Low | Query PVC status |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Manual NFS Configuration | Admin-configured devices are safer | Force device selection, hide raw NFS |
| Auto-Select First Device | May pick wrong device | Require explicit selection |

### Implementation Notes

**OutputTab Gap:**
The `OutputTab.tsx` currently defaults `type: 'nfs'` (line 39) but should align with ConnectionTab's `NAS` selection pattern. The `DestinationEditorModal` needs NAS device dropdown similar to ConnectionTab.

**Existing NAS API Endpoints:**
```
GET  /api/v1/nas-devices                     - List all
POST /api/v1/nas-devices                     - Create
GET  /api/v1/nas-devices/{id}                - Get by ID
PUT  /api/v1/nas-devices/{id}                - Update
DELETE /api/v1/nas-devices/{id}              - Delete
POST /api/v1/nas-devices/{id}/test-connection - Test connectivity
POST /api/v1/nas-devices/{id}/provision      - Create PV/PVC
POST /api/v1/nas-devices/{id}/deprovision    - Delete PV/PVC
```

---

## Feature Dependencies

```
Feature Dependencies (Must complete before dependent features):

SignalR Real-Time Monitoring
  └── Backend SignalR Hub implementation
      └── OTEL data access layer
          └── Prometheus query proxy

Device Health Monitoring
  └── Keep-Alive Background Service
      └── Health data storage (expand NasDevice entity)
          └── SignalR push integration (optional)

DemoDataGenerator Simulator Integration
  └── File-simulator deployed and accessible
      └── API client implementation
          └── Entity mapping logic

Archive Extraction (Mostly Done)
  └── Cross-protocol streaming (future enhancement)

NAS in OutputTab
  └── NasDevice dropdown component (reuse from ConnectionTab)
      └── DestinationEditorModal update
```

---

## MVP Recommendation for v0.2.0

### Must Include (Table Stakes)

1. **Replace Mock Monitoring Data** - Core functionality must work
2. **Device Health Status Display** - Operators need visibility
3. **DemoDataGenerator API Integration** - Testing requires demo data
4. **NAS Selection in OutputTab** - Complete the NAS integration story

### Should Include (High-Value Differentiators)

5. **SignalR for Monitoring Alerts** - Real-time critical alerts
6. **Latency Measurement** - Performance baseline
7. **Historical Health Chart** - 24-hour trend

### Defer to v0.3.0

- Distributed trace visualization (high complexity)
- Cross-protocol archive streaming (niche use case)
- Auto-failover notification (requires redundancy model)

---

## Prioritization Matrix

| Feature | Business Value | Technical Complexity | Risk | Priority |
|---------|----------------|---------------------|------|----------|
| Replace Mock Monitoring Data | High | Medium | Low | **P0** |
| Device Health Display | High | Low | Low | **P0** |
| DemoDataGenerator API | Medium | Low | Low | **P0** |
| NAS in OutputTab | Medium | Low | Low | **P1** |
| SignalR Real-Time Alerts | High | Medium | Medium | **P1** |
| Latency Measurement | Medium | Medium | Low | **P1** |
| Historical Health Chart | Medium | Medium | Low | **P2** |
| Keep-Alive Service | Medium | Medium | Medium | **P2** |
| Distributed Tracing UI | Low | High | High | **P3** |

---

## Sources

- [Real-Time Analytics with SignalR and InfluxDB](https://developersvoice.com/blog/data-analytics/real-time-analytics-with-influxdb/)
- [SignalR Deep Dive](https://ably.com/topic/signalr-deep-dive)
- [Health Checking Best Practices](https://carlmastrangelo.com/blog/health-checking-best-practices)
- [Server Health Monitoring: Key Metrics](https://middleware.io/blog/server-health-monitoring/)
- [Network Latency: Types, Causes, and Fixes](https://last9.io/blog/network-latency-types-causes-and-fixes/)
- [CrossFTP - Archive Browsing](https://www.crossftp.com/)
- EZ Platform codebase analysis (ConnectionTab.tsx, NasDevice.cs, IArchiveService.cs)
- File-simulator-suite codebase (ControlApi, SignalR Hubs, DiscoveredServer.cs)
