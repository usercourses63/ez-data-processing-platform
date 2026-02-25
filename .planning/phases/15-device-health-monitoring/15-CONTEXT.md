# Phase 15: Device Health Monitoring - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace mock data on the System Monitoring page with real health checks for NAS devices and AdminServers. Implement scheduled health check jobs that test connectivity and latency, persist results in MongoDB, and display real health status on the frontend with auto-refresh polling.

</domain>

<decisions>
## Implementation Decisions

### Health check behavior
- NAS devices: NFS mount test (attempt to list files on mount path, measure latency)
- AdminServers: Both health endpoint (/health HTTP check) AND protocol connectivity test (FTP login, SFTP handshake, etc.)
- Health states: Healthy / Degraded / Down (three-state model)
- Skip disabled/deprovisioned devices (show as "Disabled" on monitoring page)
- Dedicated API endpoint: GET /api/v1/health-status returns all devices with health state, latency, last check time

### Monitoring page display
- Status cards: one card per device with colored status badge (green/yellow/red)
- Card info: status badge + latency, last check timestamp, device type & role, uptime percentage (24h)
- Separate sections: "NAS Devices" and "Admin Servers" with their own card grids
- Summary bar at top: aggregate counts per status (e.g., "6/8 Healthy, 1 Degraded, 1 Down")
- Auto-refresh via frontend polling (prepares for Phase 16 SignalR upgrade)
- Card info is sufficient — no drill-down/expand on click

### Failure & alerting
- 3 consecutive failures before marking device as Down (Healthy -> Degraded at 1-2 failures -> Down at 3+)
- Visual status only — no external notifications or Prometheus alerts in this phase
- Auto-recover: when checks start passing again, device transitions back to Healthy automatically
- Show error reason on card when Degraded or Down (e.g., "Connection refused", "Timeout after 5s")

### History & persistence
- Store health check history in MongoDB (not just latest state)
- 7-day retention with TTL index
- Uptime percentage calculated over last 24 hours, displayed on card
- Uptime number only — no sparkline or trend chart

### Claude's Discretion
- Health check frequency (suggested range: 10-60 seconds)
- Latency thresholds for Degraded state (NAS and AdminServer)
- Which service owns the health check jobs (DataSourceManagement with Quartz.NET suggested)
- Polling interval for frontend auto-refresh

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key outcomes: real health data replaces mock data, uptime percentage visible, error reasons shown for failed devices.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. SignalR real-time updates are already planned as Phase 16.

</deferred>

---

*Phase: 15-device-health-monitoring*
*Context gathered: 2026-02-25*
