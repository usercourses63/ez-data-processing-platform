/**
 * SignalR hook for real-time monitoring data from /hubs/monitoring
 * v0.2.0: MON-07 SignalR Real-Time Updates (Phase 16)
 *
 * Connects to the MonitoringHub and receives 7 event types + InitialState.
 * Manages connection lifecycle with automatic reconnection, toast notifications,
 * and an isMountedRef guard for unmount safety.
 */

import { useEffect, useState, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  ServiceStatus,
  PipelineEvent,
  DashboardMetrics,
  MetricDataPoint,
} from '../types/monitoring.types';
import {
  PodStatus,
  DistributedTrace,
  TraceSpan,
  MessageQueue,
  Alert,
  ClusterInfo,
} from '../types/kubernetes.types';
import { DeviceHealthStatusResponse } from '../types/device-health.types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export interface MonitoringHubResult {
  connectionState: ConnectionState;
  isConnected: boolean;
  deviceHealth: DeviceHealthStatusResponse | null;
  services: ServiceStatus[];
  pods: PodStatus[];
  metrics: DashboardMetrics | null;
  queues: MessageQueue[];
  alerts: Alert[];
  trace: DistributedTrace | null;
  clusterInfo: ClusterInfo | null;
  events: PipelineEvent[];
  lastUpdate: Date | null;
}

// --- PascalCase -> camelCase mappers ---

function mapServiceStatus(raw: any): ServiceStatus {
  return {
    id: raw.Id,
    name: raw.Name,
    displayName: raw.DisplayName,
    status: raw.Status?.toLowerCase?.() ?? 'unknown',
    port: raw.Port,
    icon: raw.Icon ?? '',
    cpu: raw.Cpu,
    memory: raw.Memory,
    throughput: raw.Throughput,
    errorRate: raw.ErrorRate,
    latency: raw.Latency,
    uptime: raw.Uptime,
    restarts: raw.Restarts,
    queueDepth: raw.QueueDepth,
  };
}

function mapPodStatus(raw: any): PodStatus {
  const statusMap: Record<string, PodStatus['status']> = {
    Running: 'running',
    Pending: 'pending',
    Error: 'error',
    Terminated: 'terminated',
    Failed: 'error',
  };
  return {
    name: raw.Name,
    service: raw.Service,
    status: statusMap[raw.Status] ?? 'pending',
    restarts: raw.Restarts,
    cpu: raw.Cpu,
    memory: raw.Memory,
    age: raw.Age,
    node: raw.Node,
  };
}

function mapMetricDataPoint(raw: any): MetricDataPoint {
  return {
    timestamp: new Date(raw.Timestamp),
    value: raw.Value,
  };
}

function mapDashboardMetrics(raw: any): DashboardMetrics {
  return {
    totalThroughput: raw.TotalThroughput,
    successRate: raw.SuccessRate,
    avgLatency: raw.AvgLatency,
    activeJobs: raw.ActiveJobs,
    queueDepth: raw.QueueDepth,
    errorRate: raw.ErrorRate,
    throughputHistory: (raw.ThroughputHistory ?? []).map(mapMetricDataPoint),
    latencyHistory: (raw.LatencyHistory ?? []).map(mapMetricDataPoint),
    errorHistory: (raw.ErrorHistory ?? []).map(mapMetricDataPoint),
  };
}

function mapMessageQueue(raw: any): MessageQueue {
  return {
    name: raw.Name,
    topic: raw.Topic,
    depth: raw.Depth,
    rate: raw.Rate,
    consumers: raw.Consumers,
    status: raw.Status?.toLowerCase?.() ?? 'healthy',
  };
}

function mapAlert(raw: any): Alert {
  return {
    id: raw.Id,
    type: raw.Type?.toLowerCase?.() ?? 'info',
    icon: raw.Icon ?? '',
    title: raw.Title,
    message: raw.Message,
    timestamp: new Date(raw.Timestamp),
    service: raw.Service,
  };
}

function mapTraceSpan(raw: any): TraceSpan {
  return {
    service: raw.Service,
    serviceName: raw.ServiceName,
    start: raw.Start,
    duration: raw.Duration,
    color: raw.Color,
  };
}

function mapDistributedTrace(raw: any): DistributedTrace {
  return {
    traceId: raw.TraceId,
    totalDuration: raw.TotalDuration,
    spans: (raw.Spans ?? []).map(mapTraceSpan),
    timestamp: new Date(raw.Timestamp),
  };
}

function mapClusterInfo(raw: any): ClusterInfo {
  return {
    clusterName: raw.ClusterName,
    namespace: raw.Namespace,
    version: raw.Version,
    nodeCount: raw.NodeCount,
    totalPods: raw.TotalPods,
    healthyPods: raw.HealthyPods,
  };
}

function mapPipelineEvent(raw: any): PipelineEvent {
  return {
    id: raw.Id,
    timestamp: new Date(raw.Timestamp),
    service: raw.Service,
    level: raw.Level?.toLowerCase?.() ?? 'info',
    message: raw.Message,
    correlationId: raw.CorrelationId,
  };
}

/**
 * Normalize DeviceHealthStatusResponse from camelCase (SignalR) or PascalCase (HTTP API)
 */
function normalizeHealthResponse(raw: any): DeviceHealthStatusResponse {
  const normalizeDevice = (d: any): any => ({
    DeviceId: d.DeviceId || d.deviceId,
    DeviceName: d.DeviceName || d.deviceName,
    DeviceType: d.DeviceType || d.deviceType,
    DeviceSubType: d.DeviceSubType || d.deviceSubType,
    Role: d.Role || d.role,
    Status: d.Status || d.status,
    LatencyMs: d.LatencyMs ?? d.latencyMs,
    LastCheckTime: d.LastCheckTime || d.lastCheckTime,
    ErrorMessage: d.ErrorMessage || d.errorMessage,
    UptimePercentage24h: d.UptimePercentage24h ?? d.uptimePercentage24h ?? 0,
    IsActive: d.IsActive ?? d.isActive ?? true,
  });

  return {
    TotalDevices: raw.TotalDevices ?? raw.totalDevices ?? 0,
    HealthyCount: raw.HealthyCount ?? raw.healthyCount ?? 0,
    DegradedCount: raw.DegradedCount ?? raw.degradedCount ?? 0,
    DownCount: raw.DownCount ?? raw.downCount ?? 0,
    DisabledCount: raw.DisabledCount ?? raw.disabledCount ?? 0,
    NasDevices: (raw.NasDevices || raw.nasDevices || []).map(normalizeDevice),
    AdminServers: (raw.AdminServers || raw.adminServers || []).map(normalizeDevice),
  };
}

/**
 * Multi-event SignalR hook for the monitoring dashboard.
 * Connects to the MonitoringHub and manages all real-time data streams.
 */
export function useMonitoringHub(hubUrl: string): MonitoringHubResult {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [deviceHealth, setDeviceHealth] = useState<DeviceHealthStatusResponse | null>(null);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [pods, setPods] = useState<PodStatus[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [queues, setQueues] = useState<MessageQueue[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [trace, setTrace] = useState<DistributedTrace | null>(null);
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const isMountedRef = useRef(true);
  const wasConnectedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // --- Event handlers ---
    // Register both PascalCase and lowercase names (SignalR .NET may send either)
    const onEvent = (name: string, handler: (raw: any) => void) => {
      connection.on(name, handler);
      const lower = name.charAt(0).toLowerCase() + name.slice(1);
      if (lower !== name) connection.on(lower, handler);
    };

    onEvent('DeviceHealthUpdate', (raw: any) => {
      if (!isMountedRef.current) return;
      setDeviceHealth(normalizeHealthResponse(raw));
      setLastUpdate(new Date());
    });

    onEvent('ServiceStatusUpdate', (raw: any[]) => {
      if (!isMountedRef.current) return;
      setServices((raw ?? []).map(mapServiceStatus));
      setLastUpdate(new Date());
    });

    onEvent('PodStatusUpdate', (raw: any[]) => {
      if (!isMountedRef.current) return;
      setPods((raw ?? []).map(mapPodStatus));
      setLastUpdate(new Date());
    });

    onEvent('MetricsUpdate', (raw: any) => {
      if (!isMountedRef.current) return;
      setMetrics(mapDashboardMetrics(raw));
      setLastUpdate(new Date());
    });

    onEvent('QueueStatusUpdate', (raw: any[]) => {
      if (!isMountedRef.current) return;
      setQueues((raw ?? []).map(mapMessageQueue));
      setLastUpdate(new Date());
    });

    onEvent('AlertUpdate', (raw: any[]) => {
      if (!isMountedRef.current) return;
      setAlerts((raw ?? []).map(mapAlert));
      setLastUpdate(new Date());
    });

    onEvent('TraceUpdate', (raw: any) => {
      if (!isMountedRef.current) return;
      setTrace(Array.isArray(raw) && raw.length > 0 ? mapDistributedTrace(raw[0]) : null);
      setLastUpdate(new Date());
    });

    onEvent('PipelineEventUpdate', (raw: any) => {
      if (!isMountedRef.current) return;
      setEvents(prev => [mapPipelineEvent(raw), ...prev].slice(0, 50));
      setLastUpdate(new Date());
    });

    onEvent('EntityChanged', (raw: any) => {
      if (!isMountedRef.current) return;
      const entityType = raw.entityType || raw.EntityType || '';
      const entityId = raw.entityId || raw.EntityId || '';
      const action = raw.action || raw.Action || '';
      const version = raw.version || raw.Version || 0;
      console.log(`[SignalR] EntityChanged: ${entityType} ${entityId} ${action} v${version}`);

      const queryKeyMap: Record<string, string[]> = {
        'DataSource': ['datasources', 'datasource'],
        'NasDevice': ['nasDevices', 'nasdevices'],
        'AdminServer': ['adminservers', 'servers'],
      };

      const keysToInvalidate = queryKeyMap[entityType] || [entityType.toLowerCase()];
      keysToInvalidate.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    });

    const handleInitialState = (raw: any) => {
      if (!isMountedRef.current) return;
      const dh = raw.DeviceHealth || raw.deviceHealth;
      if (dh) setDeviceHealth(normalizeHealthResponse(dh));
      const svc = raw.Services || raw.services;
      if (svc) setServices((svc as any[]).map(mapServiceStatus));
      const p = raw.Pods || raw.pods;
      if (p) setPods((p as any[]).map(mapPodStatus));
      const m = raw.Metrics || raw.metrics;
      if (m) setMetrics(mapDashboardMetrics(m));
      const q = raw.Queues || raw.queues;
      if (q) setQueues((q as any[]).map(mapMessageQueue));
      const a = raw.Alerts || raw.alerts;
      if (a) setAlerts((a as any[]).map(mapAlert));
      const tr = raw.Traces || raw.traces;
      if (tr?.length) setTrace(mapDistributedTrace(tr[0]));
      const ci = raw.ClusterInfo || raw.clusterInfo;
      if (ci) setClusterInfo(mapClusterInfo(ci));
      const pe = raw.PipelineEvents || raw.pipelineEvents;
      if (pe) {
        setEvents((pe as any[]).map(mapPipelineEvent).slice(0, 50));
      }
      setLastUpdate(new Date());
    };
    connection.on('InitialState', handleInitialState);
    connection.on('initialState', handleInitialState);

    // --- Connection lifecycle ---

    connection.onreconnecting(() => {
      if (!isMountedRef.current) return;
      setConnectionState('reconnecting');
      if (wasConnectedRef.current) {
        message.warning(t('monitoring.connection.lost'), 5);
      }
    });

    connection.onreconnected(() => {
      if (!isMountedRef.current) return;
      setConnectionState('connected');
      message.success(t('monitoring.connection.restored'), 3);
    });

    connection.onclose(() => {
      if (!isMountedRef.current) return;
      setConnectionState('disconnected');
    });

    // --- Start connection ---

    connection.start()
      .then(() => {
        if (!isMountedRef.current) return;
        setConnectionState('connected');
        wasConnectedRef.current = true;
      })
      .catch((err) => {
        if (!isMountedRef.current) return;
        setConnectionState('disconnected');
        console.error('SignalR connection failed:', err);
      });

    // --- Cleanup ---

    return () => {
      isMountedRef.current = false;
      connection.off('EntityChanged');
      connection.stop().catch((err) => {
        console.warn('Error stopping SignalR connection:', err);
      });
    };
  }, [hubUrl, t, queryClient]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    deviceHealth,
    services,
    pods,
    metrics,
    queues,
    alerts,
    trace,
    clusterInfo,
    events,
    lastUpdate,
  };
}
