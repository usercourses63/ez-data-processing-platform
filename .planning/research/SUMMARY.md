# Research Summary: EZ Platform v0.2.0 Stack Additions

**Domain:** Data Processing Platform - Stack additions for production validation features
**Researched:** 2026-02-11
**Overall Confidence:** HIGH

---

## Executive Summary

Research for v0.2.0 stack additions reveals that the EZ Platform already has most required capabilities in place. The existing .NET 10 + React 19 stack with comprehensive OTEL instrumentation, Kafka/MassTransit messaging, and MongoDB persistence provides a solid foundation.

Only minimal additions are needed: two health check packages for device monitoring (`AspNetCore.HealthChecks.Network` and `AspNetCore.HealthChecks.Uris`), and a frontend package upgrade (`@microsoft/signalr` from 7.0.11 to 10.0.0). SignalR backend capabilities are built into ASP.NET Core 10.0 with no additional packages. Archive extraction is already fully implemented via SharpCompress 0.38.0.

The file-simulator-suite project provides proven patterns for SignalR hubs and a React useSignalR hook that can be directly adopted. The FileSimulatorClient from that project offers a ready-made API client for multi-protocol file operations (FTP, SFTP, S3, SMB, HTTP, NFS).

---

## Key Findings

**Stack:** Add 2 health check packages (AspNetCore.HealthChecks.Network 9.0.0, AspNetCore.HealthChecks.Uris 9.0.0), upgrade @microsoft/signalr to 10.0.0

**Architecture:** SignalR hubs for real-time monitoring using patterns from file-simulator-suite; OTEL verification via existing API endpoints (Jaeger, Prometheus, Elasticsearch)

**Critical Pitfalls:**
- CP-01: SignalR WebSocket routing failures in Kubernetes (use SkipNegotiation + WebSockets-only)
- CP-05: Archive extraction memory exhaustion (use streaming, limit nesting depth)
- CP-06: Helm chart air-gapped deployment failures (mirror all images, create comprehensive image list)

---

## Implications for Roadmap

Based on research, suggested phase structure for v0.2.0 implementation:

### Phase 1: SignalR Infrastructure
- **Rationale:** Foundation for real-time monitoring features
- **Addresses:** System Monitoring page real-time updates
- **Technology:** Built-in ASP.NET Core SignalR + @microsoft/signalr@10.0.0
- **Effort:** Low - patterns available from file-simulator-suite
- **Pitfalls:** CP-01, CP-02 (WebSocket routing, reconnection)

### Phase 2: Device Health Monitoring
- **Rationale:** Requires health check packages before UI can display health
- **Addresses:** Device health/latency monitoring for file access protocols
- **Technology:** AspNetCore.HealthChecks.Network + AspNetCore.HealthChecks.Uris
- **Effort:** Low - packages are drop-in with existing health check infrastructure
- **Pitfalls:** MP-01 (Redis backplane config if scaling)

### Phase 3: OTEL Verification Tooling
- **Rationale:** Can proceed in parallel once infrastructure is understood
- **Addresses:** OTEL verification/audit across all 9 microservices
- **Technology:** No new packages - uses existing APIs (Jaeger, Prometheus, Elasticsearch)
- **Effort:** Medium - requires verification script/dashboard development
- **Pitfalls:** CP-03, MP-04 (ActivitySource registration, metric instrument types)

### Phase 4: File-Simulator Integration
- **Rationale:** Depends on understanding target protocols
- **Addresses:** DemoDataGenerator API client integration for multi-protocol file upload
- **Technology:** FileSimulatorClient from file-simulator-suite (copy or reference)
- **Effort:** Low - client library already built and tested
- **Pitfalls:** MP-02 (tight coupling, circuit breaker needed)

### Phase 5: Archive Extraction (Verification Only)
- **Rationale:** Already implemented, needs verification across protocols
- **Addresses:** Archive file extraction across protocols
- **Technology:** SharpCompress 0.38.0 (already in place)
- **Effort:** Low - testing only
- **Pitfalls:** CP-05, SM-02 (memory exhaustion, path traversal)

**Phase Ordering Rationale:**
- SignalR first because it's foundation for real-time UI
- Health monitoring second because it feeds into SignalR broadcasts
- OTEL verification parallel because it's independent infrastructure validation
- File-simulator integration later because it's tooling, not production code
- Archive extraction last because it's verification of existing capability

**Research Flags for Phases:**
- Phase 1 (SignalR): YES - Multiple K8s/scaling pitfalls documented
- Phase 2 (Health): LOW - Standard packages, documented patterns
- Phase 3 (OTEL): LOW - Well-documented, existing configuration to verify
- Phase 4 (File-Simulator): LOW - Code available in file-simulator-suite
- Phase 5 (Archive): YES - Memory management complex, security implications

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack Additions | HIGH | Verified with NuGet, npm, and official docs |
| SignalR Patterns | HIGH | Proven patterns from file-simulator-suite |
| Health Check Packages | HIGH | Widely used, well-documented |
| OTEL Verification | MEDIUM | Approach clear, specific API details may vary |
| File-Simulator Client | HIGH | Direct code review of working implementation |
| Archive Extraction | HIGH | Already implemented and in use |
| Pitfalls | HIGH | Documented from official sources and GitHub issues |

---

## Gaps to Address

1. **SignalR Scaling:** Current research assumes single-instance deployment. For HA/multi-instance, Redis backplane would be needed (Microsoft.AspNetCore.SignalR.StackExchangeRedis). Defer to future milestone.

2. **OTEL API Details:** Specific Jaeger/Prometheus query patterns for verification dashboard may need refinement during implementation.

3. **File-Simulator Integration Method:** Decision needed on whether to copy source files, use git submodule, or publish NuGet package from file-simulator-suite.

4. **SMB Health Check:** AspNetCore.HealthChecks.Network does not include native SMB health check - will need custom implementation using SMBLibrary or TCP port check.

---

## Files Created

| File | Purpose |
|------|---------|
| `.planning/research/SUMMARY.md` | Executive summary with roadmap implications |
| `.planning/research/STACK.md` | Technology recommendations with versions and rationale |
| `.planning/research/FEATURES.md` | Feature landscape (table stakes, differentiators, anti-features) |
| `.planning/research/ARCHITECTURE.md` | Architecture patterns for new feature integration |
| `.planning/research/PITFALLS.md` | Domain pitfalls with prevention strategies |

---

## Quick Reference: Package Changes

### Backend (Directory.Packages.props additions)
```xml
<PackageVersion Include="AspNetCore.HealthChecks.Network" Version="9.0.0" />
<PackageVersion Include="AspNetCore.HealthChecks.Uris" Version="9.0.0" />
```

### Frontend (package.json update)
```json
{
  "@microsoft/signalr": "^10.0.0"
}
```

### No Changes Needed For
- SignalR backend (built into ASP.NET Core 10.0)
- OTEL instrumentation (OpenTelemetry 1.14.0 already configured)
- Archive extraction (SharpCompress 0.38.0 already implemented)
- File protocol clients (FluentFTP, SSH.NET, AWSSDK.S3, SMBLibrary all present)

---

## Sources

- [ASP.NET Core SignalR Overview](https://learn.microsoft.com/en-us/aspnet/core/signalr/introduction?view=aspnetcore-10.0)
- [Microsoft.AspNetCore.SignalR.Client 10.0.3](https://www.nuget.org/packages/Microsoft.AspNetCore.SignalR.Client)
- [@microsoft/signalr npm](https://www.npmjs.com/package/@microsoft/signalr)
- [AspNetCore.HealthChecks.Network](https://www.nuget.org/packages/AspNetCore.HealthChecks.Network)
- [Xabaril/AspNetCore.Diagnostics.HealthChecks](https://github.com/Xabaril/AspNetCore.Diagnostics.HealthChecks)
- [OpenTelemetry .NET](https://opentelemetry.io/docs/languages/dotnet/)
- [G-Research: SignalR on Kubernetes](https://www.gresearch.com/news/signalr-on-kubernetes/)
- file-simulator-suite source code (local repository at C:\Users\UserC\source\repos\file-simulator-suite)
