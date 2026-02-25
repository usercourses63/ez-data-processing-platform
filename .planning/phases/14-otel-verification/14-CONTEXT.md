# Phase 14: OTEL Verification - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify the complete observability pipeline (logs, traces, metrics) for all 9 microservices. Build verification tooling that confirms each service emits signals to Elasticsearch (logs), Jaeger (traces), and Prometheus (metrics). Fix any gaps found — this phase delivers both the verification tool AND working observability for every service.

</domain>

<decisions>
## Implementation Decisions

### Verification scope
- Existence check only — confirm signals exist, don't validate content/schema
- All 9 microservices checked equally, no prioritization
- Idle state check — services just need to be running, no need to trigger file processing
- Per-service breakdown: each service gets pass/fail for logs, traces, and metrics (9 services x 3 signals = 27 checks)

### Verification tooling
- Terminal table output — colored pass/fail matrix printed to terminal
- One-shot run, no persistence or history tracking

### Gap remediation
- Fix all gaps in this phase — phase isn't done until all 9 services pass
- Full fix depth: config changes, code instrumentation, new ActivitySource spans, custom metrics — whatever it takes
- Full deployment cycle in scope: fix code, rebuild image, load to minikube, redeploy, verify
- Batch approach: run verification, identify all gaps, fix all services, then re-verify everything

### Signal quality bar
- Logs: at least one log entry from the service exists in Elasticsearch
- Traces: at least one trace/span from the service exists in Jaeger (Claude decides appropriate quality bar for span naming/depth)
- Metrics: at least one metric from the service exists in Prometheus (infrastructure or business)
- Verify end results only — don't audit OTEL Collector config separately

### Claude's Discretion
- Tool form (PowerShell script, dotnet CLI tool, or bash script)
- Tool access model (port-forward only vs cluster-internal support)
- Run mode (one-shot vs rerunnable with history)
- Trace quality bar detail (whether to check for named spans vs any span)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The key outcome is a pass/fail matrix covering all 9 services x 3 signal types, with all gaps fixed by end of phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-otel-verification*
*Context gathered: 2026-02-25*
