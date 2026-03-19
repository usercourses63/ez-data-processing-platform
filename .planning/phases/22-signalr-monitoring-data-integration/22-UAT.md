---
status: diagnosed
phase: 22-signalr-monitoring-data-integration
source: [22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md]
started: 2026-03-19T12:00:00Z
updated: 2026-03-19T13:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Monitoring Dashboard - Real Cluster Data
expected: Open System Monitoring page. With K8s cluster running and SignalR connected, all tabs show real data (cluster name, version, real pod names, real metrics).
result: issue
reported: "Playwright confirmed: Dashboard renders with 6 tabs and SignalR WebSocket connects (negotiate 200, connectionId returned). But infra broadcast loop fails silently — ClusterHeader never renders, skeletons remain indefinitely after 15s. Root cause: KafkaMonitoringService.GetQueueStatusesAsync() throws Confluent.Kafka.KafkaException (broker transport failure — kafka:9092 DNS not resolving correctly from inside pod). Since RunInfrastructureBroadcastLoop uses Task.WhenAll, one Kafka failure kills all 6 broadcasts (ServiceStatusUpdate, PodStatusUpdate, MetricsUpdate, ClusterInfo, AlertUpdate, TraceUpdate). DeviceHealthUpdate still works (separate 5s loop)."
severity: major

### 2. Skeleton Loading Before SignalR Data Arrives
expected: Fresh page load shows Ant Design skeleton placeholders (not mock data, not blank). Mock data files confirmed deleted. Once SignalR sends data, skeletons replaced.
result: pass

### 3. DataSource List Auto-Refreshes on Remote Change
expected: Open Data Sources list. In a second tab, create/update/delete a DataSource. The first tab list updates automatically within seconds without manual refresh.
result: pass

### 4. NAS Device List Auto-Refreshes on Remote Change
expected: Open Admin → NAS Devices. In a second tab, create/update a NAS device. First tab refreshes automatically via EntityChanged SignalR event.
result: skipped
reason: No NAS devices configured in this environment — cannot test update scenario

### 5. Optimistic Locking - 409 Conflict on Stale Edit
expected: Open a DataSource in two tabs. Save in Tab 1. Try to save in Tab 2 (old Version). Tab 2 shows Hebrew conflict error instead of silently overwriting.
result: pass

## Summary

total: 5
passed: 3
issues: 1
pending: 0
skipped: 1

## Gaps

- truth: "Monitoring dashboard shows real cluster data (services, pods, metrics) from K8s/Prometheus after SignalR connects"
  status: failed
  reason: "Playwright confirmed: skeleton stays indefinitely after 15s. SignalR connects (negotiate 200) but RunInfrastructureBroadcastLoop fails on every cycle due to KafkaMonitoringService throwing Confluent.Kafka exception. Task.WhenAll causes all 6 infra broadcasts to be skipped."
  severity: major
  test: 1
  root_cause: "KafkaMonitoringService.GetQueueStatusesAsync() fails because configmap has kafka:9092 but DNS resolves as kafka-service only (not bare 'kafka'). Actually per getent, 'kafka' does resolve in the pod but Confluent.Kafka rdkafka library uses its own resolver and fails. The real fix: wrap each monitoring service call individually so Kafka failure does not abort K8s/Prometheus broadcasts."
  artifacts:
    - path: "src/Services/DataSourceManagementService/Services/MonitoringBroadcaster.cs"
      issue: "RunInfrastructureBroadcastLoop uses Task.WhenAll — single Kafka failure kills all 6 broadcasts"
    - path: "helm/ez-platform/templates/configmaps/services-config.yaml"
      issue: "kafka-server may point to wrong internal address for Confluent.Kafka rdkafka resolver"
  missing:
    - "Wrap each task independently: catch Kafka errors and return empty queues, continue broadcasting K8s/Prometheus data"
    - "Either fix kafka bootstrap address (try kafka-service:9092 or kafka-0.kafka-service:9092) OR make KafkaMonitoringService return empty list on connection failure"
  debug_session: ""
