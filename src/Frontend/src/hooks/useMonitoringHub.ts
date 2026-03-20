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

    connection.on('DeviceHealthUpdate', (raw: any) => {
      if (!isMountedRef.current) return;
      setDeviceHealth(raw);
      setLastUpdate(new Date());
    });

    connection.on('ServiceStatusUpdate', (raw: any[]) => {
      if (!isMountedRef.current) return;
      setServices((raw ?? []).map(mapServiceStatus));
      setLastUpdate(new Date());
    });

    connection.on('PodStatusUpdate', (raw: any[]) => {
      if (!isMountedRef.current) return;
      setPods((raw ?? []).map(mapPodStatus));
      setLastUpdate(new Date());
    });

    connection.on('MetricsUpdate', (raw: any) => {
      if (!isMountedRef.current) return;
      setMetrics(mapDashboardMetrics(raw));
      setLastUpdate(new Date());
    });

    connection.on('QueueStatusUpdate', (raw: any[]) => {
      if (!isMountedRef.current) return;
      setQueues((raw ?? []).map(mapMessageQueue));
      setLastUpdate(new Date());
    });

    connection.on('AlertUpdate', (raw: any[]) => {
      if (!isMountedRef.current) return;
      setAlerts((raw ?? []).map(mapAlert));
      setLastUpdate(new Date());
    });

    connection.on('TraceUpdate', (raw: any) => {
      if (!isMountedRef.current) return;
      setTrace(Array.isArray(raw) && raw.length > 0 ? mapDistributedTrace(raw[0]) : null);
      setLastUpdate(new Date());
    });

    connection.on('PipelineEventUpdate', (raw: any) => {
      if (!isMountedRef.current) return;
      setEvents(prev => [mapPipelineEvent(raw), ...prev].slice(0, 50));
      setLastUpdate(new Date());
    });

    connection.on('EntityChanged', (raw: any) => {
      if (!isMountedRef.current) return;
      // SignalR .NET serializes with camelCase by default
      const entityType = raw.entityType || raw.EntityType || '';
      const entityId = raw.entityId || raw.EntityId || '';
      const action = raw.action || raw.Action || '';
      const version = raw.version || raw.Version || 0;
      console.log(`[SignalR] EntityChanged: ${entityType} ${entityId} ${action} v${version}`);

      // Invalidate React Query cache for the changed entity type
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

    connection.on('InitialState', (raw: any) => {
      if (!isMountedRef.current) return;
      if (raw.DeviceHealth) setDeviceHealth(raw.DeviceHealth);
      if (raw.Services) setServices((raw.Services as any[]).map(mapServiceStatus));
      if (raw.Pods) setPods((raw.Pods as any[]).map(mapPodStatus));
      if (raw.Metrics) setMetrics(mapDashboardMetrics(raw.Metrics));
      if (raw.Queues) setQueues((raw.Queues as any[]).map(mapMessageQueue));
      if (raw.Alerts) setAlerts((raw.Alerts as any[]).map(mapAlert));
      if (raw.Traces?.length) setTrace(mapDistributedTrace(raw.Traces[0]));
      if (raw.ClusterInfo) setClusterInfo(mapClusterInfo(raw.ClusterInfo));
      if (raw.PipelineEvents) {
        setEvents((raw.PipelineEvents as any[]).map(mapPipelineEvent).slice(0, 50));
      }
      setLastUpdate(new Date());
    });

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
