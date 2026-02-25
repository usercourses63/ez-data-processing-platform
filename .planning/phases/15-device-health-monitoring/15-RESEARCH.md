# Phase 15: Device Health Monitoring - Research

**Researched:** 2026-02-25
**Domain:** Backend health check scheduling + frontend monitoring dashboard replacement
**Confidence:** HIGH

## Summary

Phase 15 replaces the mock data generators on the System Monitoring page with real health check data for NAS devices and AdminServers. The existing monitoring page uses `monitoring-mock-data.ts` and `kubernetes-mock-data.ts` to generate random service statuses, pipeline events, and metrics. This phase introduces scheduled Quartz.NET health check jobs in the DataSourceManagement service that test device connectivity, persist results in MongoDB with TTL-based history, and expose a new API endpoint for the frontend to consume.

The backend work is well-bounded: a new `DeviceHealthCheckResult` entity, a `DeviceHealthCheckJob` Quartz.NET job, a `DeviceHealthService` that orchestrates checks and computes uptime, and a `HealthStatusController` that serves aggregated health data. The frontend work adds a new "Device Health" tab to the existing monitoring page with status cards organized by device type, a summary bar, and polling-based auto-refresh.

**Primary recommendation:** Add health check jobs to DataSourceManagement service (it already has access to NasDevice/AdminServer entities and the IConnectorFactory), create a new MongoDB collection with TTL index for health check history, and add a new tab to the monitoring page rather than replacing the existing overview tab.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- NAS devices: NFS mount test (attempt to list files on mount path, measure latency)
- AdminServers: Both health endpoint (/health HTTP check) AND protocol connectivity test (FTP login, SFTP handshake, etc.)
- Health states: Healthy / Degraded / Down (three-state model)
- Skip disabled/deprovisioned devices (show as "Disabled" on monitoring page)
- Dedicated API endpoint: GET /api/v1/health-status returns all devices with health state, latency, last check time
- Status cards: one card per device with colored status badge (green/yellow/red)
- Card info: status badge + latency, last check timestamp, device type & role, uptime percentage (24h)
- Separate sections: "NAS Devices" and "Admin Servers" with their own card grids
- Summary bar at top: aggregate counts per status (e.g., "6/8 Healthy, 1 Degraded, 1 Down")
- Auto-refresh via frontend polling (prepares for Phase 16 SignalR upgrade)
- Card info is sufficient -- no drill-down/expand on click
- 3 consecutive failures before marking device as Down (Healthy -> Degraded at 1-2 failures -> Down at 3+)
- Visual status only -- no external notifications or Prometheus alerts in this phase
- Auto-recover: when checks start passing again, device transitions back to Healthy automatically
- Show error reason on card when Degraded or Down (e.g., "Connection refused", "Timeout after 5s")
- Store health check history in MongoDB (not just latest state)
- 7-day retention with TTL index
- Uptime percentage calculated over last 24 hours, displayed on card
- Uptime number only -- no sparkline or trend chart

### Claude's Discretion
- Health check frequency (suggested range: 10-60 seconds)
- Latency thresholds for Degraded state (NAS and AdminServer)
- Which service owns the health check jobs (DataSourceManagement with Quartz.NET suggested)
- Polling interval for frontend auto-refresh

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope. SignalR real-time updates are already planned as Phase 16.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MON-05 | System Monitoring page reflects real current system components (replace mock data generators) | New "Device Health" tab with real API data replaces mock generators for device health; existing service health mock data can remain as separate concern |
| MON-06 | File access device health/latency/keep-alive monitoring (NAS devices, AdminServers) | Quartz.NET scheduled health check job using existing IConnectorFactory for AdminServer protocol tests and INasResourceService for NAS PVC status checks, persisted to MongoDB with TTL history |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Quartz.NET | 3.15.1 | Health check job scheduling | Already used in SchedulingService for DataSourcePollingJob; same pattern applies |
| MongoDB.Entities | (existing) | Health check result persistence | Already the ORM for all entities; TTL index support built-in |
| ASP.NET Core Web API | .NET 10.0 | Health status REST endpoint | Existing controller pattern in DataSourceManagement |
| React 19 + TypeScript 5 | (existing) | Frontend monitoring UI | Existing frontend stack |
| Ant Design 5.x | (existing) | Status cards, badges, grid layout | Existing UI library with RTL support |
| TanStack React Query | (existing) | Polling-based auto-refresh | Already used for data fetching throughout the frontend |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| FluentFTP | (existing) | FTP connectivity test for AdminServers | Used by FtpConnector already |
| SSH.NET | (existing) | SFTP connectivity test for AdminServers | Used by SftpConnector already |
| i18next | (existing) | Hebrew/English translations for health states | New translation keys needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Quartz.NET in DataSourceMgmt | IHostedService with Timer | Quartz provides cron expressions, misfire handling; timer is simpler but less flexible. Use Quartz for consistency with existing SchedulingService pattern. |
| MongoDB TTL index | Manual cleanup job | TTL index is zero-maintenance; manual cleanup adds unnecessary complexity |
| New tab in monitoring | Replace overview tab | Adding a tab preserves existing functionality; replacement would lose service health matrix |

**Installation:**
No new packages needed. All dependencies exist in the project via Central Package Management (Directory.Packages.props).

## Architecture Patterns

### Recommended Project Structure

**Backend (DataSourceManagementService):**
```
DataSourceManagementService/
├── Controllers/
│   └── HealthStatusController.cs        # NEW: GET /api/v1/health-status
├── Services/
│   ├── IDeviceHealthService.cs          # NEW: Health check orchestration interface
│   └── DeviceHealthService.cs           # NEW: Health check orchestration implementation
├── Jobs/
│   └── DeviceHealthCheckJob.cs          # NEW: Quartz.NET scheduled job
└── Models/
    └── Responses/
        └── DeviceHealthStatusResponse.cs # NEW: API response DTOs
```

**Shared:**
```
Shared/
├── Entities/
│   └── DeviceHealthCheckResult.cs       # NEW: MongoDB entity with TTL
```

**Frontend:**
```
src/
├── pages/monitoring/
│   ├── SystemMonitoring.tsx             # MODIFY: Add device health tab
│   └── components/
│       ├── DeviceHealthTab.tsx           # NEW: Tab container
│       ├── DeviceHealthSummaryBar.tsx    # NEW: Aggregate status counts
│       └── DeviceHealthCard.tsx          # NEW: Individual device card
├── services/
│   └── health-status-api-client.ts      # NEW: API client for health data
├── types/
│   └── device-health.types.ts           # NEW: TypeScript interfaces
└── i18n/locales/
    ├── he.json                          # MODIFY: Add health monitoring keys
    └── en.json                          # MODIFY: Add health monitoring keys
```

### Pattern 1: Health Check Entity with TTL Index

**What:** A MongoDB entity that stores each health check result with an automatic TTL expiry for 7-day retention.
**When to use:** Whenever health check history needs to be retained but auto-cleaned.

```csharp
// Source: Existing project patterns (DataProcessingBaseEntity) + MongoDB TTL index
public class DeviceHealthCheckResult : DataProcessingBaseEntity
{
    // Device identification
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public string DeviceType { get; set; } = string.Empty; // "NasDevice" or "AdminServer"

    // Health check results
    public string Status { get; set; } = "Healthy"; // Healthy, Degraded, Down
    public long LatencyMs { get; set; }
    public bool IsSuccess { get; set; }
    public string? ErrorMessage { get; set; }

    // For TTL index: MongoDB will auto-delete documents after 7 days
    public DateTime CheckedAt { get; set; } = DateTime.UtcNow;
}
```

**TTL Index creation (in Program.cs startup):**
```csharp
// Create TTL index for 7-day retention
await DB.Index<DeviceHealthCheckResult>()
    .Key(x => x.CheckedAt, KeyType.Ascending)
    .Option(o => o.ExpireAfter = TimeSpan.FromDays(7))
    .CreateAsync();
```

### Pattern 2: Quartz.NET Health Check Job

**What:** A Quartz.NET job registered in DataSourceManagement that runs on a fixed interval.
**When to use:** For the periodic health check execution.

```csharp
// Source: Existing DataSourcePollingJob pattern in SchedulingService
[DisallowConcurrentExecution]
public class DeviceHealthCheckJob : IJob
{
    private readonly IDeviceHealthService _healthService;
    private readonly ILogger<DeviceHealthCheckJob> _logger;

    public async Task Execute(IJobExecutionContext context)
    {
        await _healthService.RunHealthChecksAsync(context.CancellationToken);
    }
}
```

**Registration in Program.cs:**
```csharp
builder.Services.AddQuartz(q =>
{
    q.UseInMemoryStore();

    var jobKey = new JobKey("DeviceHealthCheck");
    q.AddJob<DeviceHealthCheckJob>(opts => opts.WithIdentity(jobKey));
    q.AddTrigger(opts => opts
        .ForJob(jobKey)
        .WithIdentity("DeviceHealthCheck-trigger")
        .WithSimpleSchedule(x => x
            .WithIntervalInSeconds(30)
            .RepeatForever()));
});
builder.Services.AddQuartzHostedService(q => q.WaitForJobsToComplete = true);
```

### Pattern 3: Three-State Health Model with Consecutive Failure Tracking

**What:** Track consecutive failure count per device to determine state transitions.
**When to use:** For the Healthy -> Degraded -> Down state machine.

```csharp
// In-memory tracker (or persisted to device entity)
// 0 failures = Healthy
// 1-2 failures = Degraded
// 3+ failures = Down
// Any success = reset to Healthy (0 failures)
```

The consecutive failure count should be tracked on the device entity itself (add `ConsecutiveFailures` field to NasDevice/AdminServer or use a separate in-memory dictionary). Recommendation: use a `ConcurrentDictionary<string, int>` in `DeviceHealthService` since this is within a single pod and doesn't need persistence -- the count resets on restart which is acceptable (devices will be rechecked immediately).

### Pattern 4: Frontend Polling with React Query

**What:** Use React Query's `refetchInterval` for automatic polling.
**When to use:** For the auto-refresh on the device health tab.

```typescript
// Source: TanStack React Query polling pattern
const { data, isLoading, error } = useQuery({
  queryKey: ['device-health-status'],
  queryFn: getDeviceHealthStatus,
  refetchInterval: 15000, // 15 seconds
  refetchIntervalInBackground: false, // Only when tab visible
});
```

### Anti-Patterns to Avoid
- **Separate microservice for health checks:** This is not complex enough to warrant a new service. DataSourceManagement already has all the dependencies (NasDeviceService, ConnectorFactory, NasResourceService).
- **Storing consecutive failure count in MongoDB:** Adds unnecessary writes. An in-memory dictionary is sufficient since pod restarts reset the count and devices get re-checked immediately.
- **Replacing the entire monitoring page:** The existing overview/pods/traces/queues tabs serve different purposes. Add device health as a new tab.
- **Using WebSocket/SSE instead of polling:** Phase 16 will add SignalR. Polling is the correct interim approach per user decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TTL-based data expiration | Custom cleanup job | MongoDB TTL index on `CheckedAt` field | Zero maintenance, built into MongoDB, handles timezone/clock issues |
| FTP/SFTP connectivity test | Custom socket check | Existing `IServerConnector.TestConnectionAsync()` via `IConnectorFactory` | Connectors already handle FTP login, SFTP handshake, timeout, error handling |
| NAS PVC status check | kubectl exec from .NET | Existing `INasResourceService.GetPvcBindingStatusAsync()` | Already implemented in Phase 12 with proper K8s client setup |
| Scheduled job execution | IHostedService + Timer | Quartz.NET (already in project) | Handles misfire policies, concurrent execution prevention, persistence options |
| Polling data refresh | Manual setInterval | React Query `refetchInterval` | Handles stale data, error retry, background refetch, cache invalidation |

**Key insight:** The existing codebase already has all the building blocks for health checking (connectors, NAS resource service, Quartz.NET). This phase is about orchestrating them on a schedule, persisting results, and displaying them.

## Common Pitfalls

### Pitfall 1: PascalCase/camelCase Mismatch in API Responses
**What goes wrong:** Frontend receives PascalCase properties but TypeScript types use camelCase (or vice versa).
**Why it happens:** DataSourceManagement uses `PropertyNamingPolicy = null` (PascalCase). Previous bug in commit `18610e0` was exactly this issue with output destinations.
**How to avoid:** Define TypeScript interfaces with PascalCase property names (matching the backend) as done in `servers-api-client.ts` and `nas-devices-api-client.ts`.
**Warning signs:** API returns data but frontend shows undefined values.

### Pitfall 2: Quartz.NET Job Not Running Due to Missing DI Registration
**What goes wrong:** Health check job is registered with Quartz but dependencies are not available via DI.
**Why it happens:** Quartz.NET creates job instances via DI. If `IDeviceHealthService` is not registered, job execution fails silently.
**How to avoid:** Register all job dependencies as scoped services AND register the job class itself. Test by checking Quartz logs on startup.
**Warning signs:** No health check results appearing in MongoDB despite job being configured.

### Pitfall 3: Health Checks Blocking Each Other
**What goes wrong:** One slow/hanging AdminServer connection test (e.g., SFTP to unreachable host) blocks all other health checks.
**Why it happens:** Sequential health checking of all devices in a single job execution.
**How to avoid:** Use `Task.WhenAll` with per-device timeout (e.g., 5 seconds per device using `CancellationTokenSource` with timeout). Mark timed-out devices as failed.
**Warning signs:** Health check job takes minutes instead of seconds.

### Pitfall 4: NAS Health Check Fails for Unprovisioned Devices
**What goes wrong:** Attempting NFS mount test for a device that hasn't been provisioned throws an exception.
**Why it happens:** NAS devices go through a provisioning lifecycle. Unprovisioned devices don't have PVC/PV.
**How to avoid:** Check `device.IsProvisioned` before running NFS health check. For unprovisioned devices, skip the check and show "Not Provisioned" status.
**Warning signs:** Health check errors for every NAS device that isn't provisioned yet.

### Pitfall 5: MongoDB TTL Index Not Cleaning Up
**What goes wrong:** Health check history grows unbounded.
**Why it happens:** TTL index was created on wrong field, or index creation failed silently.
**How to avoid:** Verify index exists after creation with `db.DeviceHealthCheckResult.getIndexes()`. Use `CheckedAt` field (DateTime) not `CreatedAt` (which may differ).
**Warning signs:** `DeviceHealthCheckResult` collection size grows linearly without plateau.

### Pitfall 6: Frontend Tab Rendering with Empty Data
**What goes wrong:** Device health tab shows loading spinner forever or empty state when no health checks have run yet.
**Why it happens:** First page load happens before first health check job execution (up to 30 seconds delay).
**How to avoid:** Handle empty state gracefully with "Health checks initializing..." message. Also trigger an immediate health check round on service startup (not just on schedule).
**Warning signs:** User opens monitoring page and sees empty device health tab.

## Code Examples

### Backend: Health Status API Response DTO
```csharp
// Source: Project conventions from existing controllers
public class DeviceHealthStatusResponse
{
    // Summary counts
    public int TotalDevices { get; set; }
    public int HealthyCount { get; set; }
    public int DegradedCount { get; set; }
    public int DownCount { get; set; }
    public int DisabledCount { get; set; }

    // Devices grouped by type
    public List<DeviceHealthInfo> NasDevices { get; set; } = new();
    public List<DeviceHealthInfo> AdminServers { get; set; } = new();
}

public class DeviceHealthInfo
{
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public string DeviceType { get; set; } = string.Empty; // NasDevice, AdminServer
    public string? DeviceSubType { get; set; } // ftp, sftp, s3, etc. (for AdminServer)
    public string Role { get; set; } = string.Empty; // Input, Output, Both, Backup
    public string Status { get; set; } = "Unknown"; // Healthy, Degraded, Down, Disabled
    public long? LatencyMs { get; set; }
    public DateTime? LastCheckTime { get; set; }
    public string? ErrorMessage { get; set; }
    public double UptimePercentage24h { get; set; }
    public bool IsActive { get; set; }
}
```

### Backend: TTL Index Creation
```csharp
// Source: Existing index creation pattern in DataSourceManagement Program.cs
// Add to the startup index creation block:
await DB.Index<DeviceHealthCheckResult>()
    .Key(x => x.CheckedAt, KeyType.Ascending)
    .Option(o => o.ExpireAfter = TimeSpan.FromDays(7))
    .CreateAsync();

await DB.Index<DeviceHealthCheckResult>()
    .Key(x => x.DeviceId, KeyType.Ascending)
    .Key(x => x.CheckedAt, KeyType.Descending)
    .CreateAsync();
```

### Backend: Uptime Calculation
```csharp
// Source: Standard uptime calculation pattern
public async Task<double> CalculateUptimePercentageAsync(
    string deviceId, TimeSpan period, CancellationToken ct)
{
    var since = DateTime.UtcNow - period;
    var checks = await DB.Find<DeviceHealthCheckResult>()
        .Match(r => r.DeviceId == deviceId && r.CheckedAt >= since)
        .ExecuteAsync(ct);

    if (!checks.Any()) return 0;

    var successCount = checks.Count(c => c.IsSuccess);
    return Math.Round((double)successCount / checks.Count * 100, 1);
}
```

### Frontend: Device Health Card Component
```tsx
// Source: Existing ServiceHealthGrid pattern + Ant Design Card
import { Card, Tag, Tooltip, Typography } from 'antd';

interface DeviceHealthCardProps {
  device: DeviceHealthInfo;
}

const statusColors: Record<string, string> = {
  Healthy: 'success',
  Degraded: 'warning',
  Down: 'error',
  Disabled: 'default',
};

const DeviceHealthCard: React.FC<DeviceHealthCardProps> = ({ device }) => (
  <Card hoverable style={{ height: '100%' }}>
    <div style={{ textAlign: 'center', marginBottom: 12 }}>
      <Tag color={statusColors[device.Status]}>{device.Status}</Tag>
      <div style={{ fontWeight: 600 }}>{device.DeviceName}</div>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
        {device.DeviceSubType || device.DeviceType} - {device.Role}
      </div>
    </div>
    {device.LatencyMs != null && (
      <div>Latency: {device.LatencyMs}ms</div>
    )}
    <div>Uptime (24h): {device.UptimePercentage24h}%</div>
    {device.ErrorMessage && (
      <Tooltip title={device.ErrorMessage}>
        <div style={{ color: '#ff4d4f', fontSize: '0.75rem' }}>
          {device.ErrorMessage}
        </div>
      </Tooltip>
    )}
  </Card>
);
```

### Frontend: React Query Polling
```typescript
// Source: TanStack React Query docs + existing project patterns
import { useQuery } from '@tanstack/react-query';

export const useDeviceHealthStatus = () => {
  return useQuery({
    queryKey: ['device-health-status'],
    queryFn: getDeviceHealthStatus,
    refetchInterval: 15000, // 15 second polling
    refetchIntervalInBackground: false,
    staleTime: 10000,
  });
};
```

## Claude's Discretion Recommendations

### Health Check Frequency: 30 seconds
**Rationale:** The existing DataSourcePollingJob and frontend monitoring page both use 30-second intervals. This balances between timely detection and resource usage. With the `[DisallowConcurrentExecution]` attribute, overlapping executions are prevented.

### Latency Thresholds for Degraded State
- **NAS devices:** > 2000ms = Degraded (NFS operations over LAN should be < 500ms normally; 2s indicates network issues)
- **AdminServers:** > 5000ms = Degraded (FTP/SFTP over WAN can be slower; 5s is generous but catches serious issues)
- These thresholds are separate from the consecutive-failure-based state transitions. A device can be "Degraded" due to either high latency OR 1-2 consecutive failures.

### Service Ownership: DataSourceManagement
**Rationale:** DataSourceManagement already owns:
1. NasDevice CRUD and INasResourceService (for PVC status checks)
2. AdminServer CRUD and IConnectorFactory (for protocol connectivity tests)
3. MongoDB access for both entity types

Adding Quartz.NET to DataSourceManagement requires only adding the Quartz packages to the csproj (they already exist in Directory.Packages.props). The SchedulingService pattern provides the template.

### Frontend Polling Interval: 15 seconds
**Rationale:** Health checks run every 30 seconds on the backend. Polling every 15 seconds on the frontend ensures the UI catches new results within half a health check cycle. This provides good responsiveness without excessive API calls. Phase 16 will replace this with SignalR push.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mock data generators (random) | Real health check data from API | Phase 15 (now) | Monitoring page reflects actual system state |
| No device health tracking | Scheduled health checks + MongoDB history | Phase 15 (now) | Proactive detection of device connectivity issues |
| Manual connection testing (click "test") | Automatic scheduled health checks | Phase 15 (now) | No human intervention needed to detect outages |

**Deprecated/outdated:**
- `monitoring-mock-data.ts` `generateServiceStatuses()` -- will be partially superseded by real device health data (but service health grid remains mock until separate infrastructure monitoring phase)
- `kubernetes-mock-data.ts` -- remains for pod/cluster data (not in Phase 15 scope)

## Open Questions

1. **NAS NFS health check from within DataSourceManagement pod**
   - What we know: NAS connection test currently checks PVC binding status via K8s API. The user decision says "NFS mount test (attempt to list files on mount path)".
   - What's unclear: DataSourceManagement may not have the NAS volumes mounted. Listing files on mount path requires the volume to be mounted in the pod running the health check.
   - Recommendation: Use PVC binding status check (already implemented) as the primary health indicator, supplemented by a TCP port check to the NFS server (Host:Port) for latency measurement. This avoids requiring DataSourceManagement to have NAS volumes mounted. If the PVC is bound and the NFS server responds to TCP, the NAS is healthy. Document this trade-off in the plan.

2. **AdminServer health endpoint check**
   - What we know: The user decision says "health endpoint (/health HTTP check) AND protocol connectivity test". AdminServers are external servers (FTP, SFTP, S3, Kafka, HTTP, etc.), not internal microservices.
   - What's unclear: External FTP/SFTP servers don't have `/health` endpoints. The `/health` check only applies to HTTP-type AdminServers.
   - Recommendation: For HTTP-type servers, check the `/health` endpoint (or just do a HEAD request to the base URL). For protocol-based servers (FTP, SFTP, S3, Kafka), use the existing `IServerConnector.TestConnectionAsync()` which already handles protocol-specific connectivity. This aligns with how the "test connection" button already works.

3. **Image rebuild requirement**
   - What we know: DataSourceManagement currently does not have Quartz.NET. Adding it requires rebuilding the Docker image and loading into minikube.
   - What's unclear: Current image tag for DataSourceManagement.
   - Recommendation: Track image rebuild as an explicit task in the plan. Follow the minikube image tag pattern (increment version to avoid caching).

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/Services/SchedulingService/Jobs/DataSourcePollingJob.cs` -- Quartz.NET job pattern
- Codebase analysis: `src/Services/SchedulingService/Program.cs` -- Quartz.NET registration pattern
- Codebase analysis: `src/Services/DataSourceManagementService/Program.cs` -- DI registration, index creation
- Codebase analysis: `src/Services/Shared/Entities/NasDevice.cs` -- NAS entity with connection test fields
- Codebase analysis: `src/Services/Shared/Entities/AdminServer.cs` -- AdminServer entity with connection fields
- Codebase analysis: `src/Services/Shared/Connectors/IConnectorFactory.cs` -- IServerConnector.TestConnectionAsync()
- Codebase analysis: `src/Services/DataSourceManagementService/Services/ServerService.cs` -- Existing connection test flow
- Codebase analysis: `src/Services/DataSourceManagementService/Services/NasDeviceService.cs` -- NAS connection test flow
- Codebase analysis: `src/Frontend/src/pages/monitoring/SystemMonitoring.tsx` -- Current monitoring page structure
- Codebase analysis: `src/Frontend/src/services/monitoring-mock-data.ts` -- Mock data to be replaced
- Codebase analysis: `src/Frontend/src/types/monitoring.types.ts` -- Existing monitoring types
- Codebase analysis: `Directory.Packages.props` -- Quartz 3.15.1 already available

### Secondary (MEDIUM confidence)
- MongoDB TTL index documentation -- standard feature, well-documented
- TanStack React Query refetchInterval -- standard feature used throughout project

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in the project, patterns proven
- Architecture: HIGH - follows existing patterns exactly (Quartz.NET job, MongoDB entity, controller, frontend tab)
- Pitfalls: HIGH - identified from actual codebase issues (PascalCase bug was real, NAS provisioning lifecycle is documented)

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable -- no external dependencies changing)
