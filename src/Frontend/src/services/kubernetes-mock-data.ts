// Mock data generators for Kubernetes metrics

import { PodStatus, DistributedTrace, TraceSpan, MessageQueue, Alert, ClusterInfo } from '../types/kubernetes.types';

// EZ Platform services mapping to pods
const EZ_SERVICES = [
  { name: 'datasource-management', displayName: 'Data Source Management', port: 5001 },
  { name: 'metrics-configuration', displayName: 'Metrics Configuration', port: 5002 },
  { name: 'validation', displayName: 'Validation Service', port: 5003 },
  { name: 'scheduling', displayName: 'Scheduling Service', port: 5004 },
  { name: 'invalidrecords', displayName: 'Invalid Records', port: 5007 },
  { name: 'fileprocessor', displayName: 'File Processor', port: 5008 },
  { name: 'output', displayName: 'Output Service', port: 5009 },
  { name: 'filediscovery', displayName: 'File Discovery', port: 5006 },
  { name: 'mongodb', displayName: 'MongoDB', port: 27017 },
  { name: 'kafka', displayName: 'Kafka', port: 9094 },
];

// Generate random pod age
function generatePodAge(): string {
  const days = Math.floor(Math.random() * 30);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Generate pod statuses for EZ Platform
export function generatePodStatuses(): PodStatus[] {
  const nodes = ['minikube'];
  const statuses: ('running' | 'pending' | 'error' | 'terminated')[] = ['running', 'running', 'running', 'pending', 'error'];

  return EZ_SERVICES.map(service => {
    const randomId = Math.random().toString(36).substring(7);
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const cpu = status === 'error' ? Math.floor(Math.random() * 20) + 80 : Math.floor(Math.random() * 60) + 20;
    const memory = status === 'error' ? Math.floor(Math.random() * 20) + 75 : Math.floor(Math.random() * 50) + 30;

    return {
      name: `${service.name}-${randomId}`,
      service: service.displayName,
      status,
      restarts: status === 'error' ? Math.floor(Math.random() * 10) : Math.floor(Math.random() * 3),
      cpu,
      memory,
      age: generatePodAge(),
      node: nodes[Math.floor(Math.random() * nodes.length)],
    };
  });
}

// Generate distributed trace data
export function generateDistributedTrace(): DistributedTrace {
  const traceId = `trace-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  // Define EZ Platform trace flow
  const spans: TraceSpan[] = [
    { service: 'gateway', serviceName: 'API Gateway', start: 0, duration: 15 },
    { service: 'datasource', serviceName: 'Data Source Mgmt', start: 5, duration: 18 },
    { service: 'filediscovery', serviceName: 'File Discovery', start: 23, duration: 25 },
    { service: 'fileprocessor', serviceName: 'File Processor', start: 48, duration: 45 },
    { service: 'validation', serviceName: 'Validation', start: 93, duration: 32 },
    { service: 'output', serviceName: 'Output Service', start: 125, duration: 28 },
    { service: 'kafka', serviceName: 'Kafka Write', start: 130, duration: 15 },
    { service: 'mongodb', serviceName: 'Database Write', start: 145, duration: 18 },
  ];

  // Add some variance
  const variance = (Math.random() - 0.5) * 20;
  spans.forEach(span => {
    span.duration += Math.floor(variance * Math.random());
    span.duration = Math.max(5, span.duration);
  });

  const totalDuration = Math.max(...spans.map(s => s.start + s.duration));

  return {
    traceId,
    totalDuration,
    spans,
    timestamp: new Date(),
  };
}

// Generate message queue statuses
export function generateMessageQueues(): MessageQueue[] {
  const kafkaTopics = [
    { name: 'dataprocessing.scheduling.filepolling', topic: 'File Polling', baseDepth: 150, baseRate: 450 },
    { name: 'dataprocessing.filesreceiver.validationrequest', topic: 'Validation Requests', baseDepth: 85, baseRate: 320 },
    { name: 'dataprocessing.validation.completed', topic: 'Validation Completed', baseDepth: 120, baseRate: 280 },
    { name: 'dataprocessing.global.processingfailed', topic: 'Processing Failed', baseDepth: 12, baseRate: 5 },
    { name: 'dataprocessing.output.filesready', topic: 'Output Ready', baseDepth: 95, baseRate: 250 },
    { name: 'dataprocessing.invalidrecords.detected', topic: 'Invalid Records', baseDepth: 28, baseRate: 15 },
  ];

  return kafkaTopics.map(topic => {
    const depth = Math.floor(topic.baseDepth + (Math.random() - 0.5) * 50);
    const rate = Math.floor(topic.baseRate + (Math.random() - 0.5) * 100);
    const consumers = Math.floor(Math.random() * 4) + 2;

    let status: 'healthy' | 'warning' | 'error' = 'healthy';
    if (depth > 200) status = 'error';
    else if (depth > 100) status = 'warning';

    return {
      name: topic.name,
      topic: topic.topic,
      depth,
      rate,
      consumers,
      status,
    };
  });
}

// Generate recent alerts
export function generateRecentAlerts(): Alert[] {
  const kafkaTopics = ['File Polling', 'Validation Requests', 'Validation Completed', 'Processing Failed', 'Output Ready'];

  const alertTemplates = [
    { type: 'warning' as const, icon: '⚠️', title: 'High Queue Depth', getMessage: () => `${kafkaTopics[Math.floor(Math.random() * kafkaTopics.length)]} queue at ${Math.floor(Math.random() * 150) + 100} messages`, service: 'kafka' },
    { type: 'error' as const, icon: '❌', title: 'Processing Error', getMessage: () => `Failed to validate ${Math.floor(Math.random() * 10)} records in batch #${Math.floor(Math.random() * 10000)}`, service: 'validation' },
    { type: 'info' as const, icon: 'ℹ️', title: 'Service Restarted', getMessage: () => `${EZ_SERVICES[Math.floor(Math.random() * 8)].displayName} service auto-recovered`, service: 'kubernetes' },
    { type: 'warning' as const, icon: '⚠️', title: 'High CPU Usage', getMessage: () => `${EZ_SERVICES[Math.floor(Math.random() * 8)].displayName} CPU at ${Math.floor(Math.random() * 20) + 75}%`, service: 'kubernetes' },
    { type: 'warning' as const, icon: '⚠️', title: 'High Memory Usage', getMessage: () => `${EZ_SERVICES[Math.floor(Math.random() * 8)].displayName} memory at ${Math.floor(Math.random() * 20) + 75}%`, service: 'kubernetes' },
    { type: 'info' as const, icon: 'ℹ️', title: 'Throughput Spike', getMessage: () => `Processing rate increased by ${Math.floor(Math.random() * 30) + 10}%`, service: 'metrics' },
    { type: 'error' as const, icon: '❌', title: 'Connection Timeout', getMessage: () => `Database connection timeout after ${Math.floor(Math.random() * 20) + 10}s`, service: 'mongodb' },
    { type: 'warning' as const, icon: '⚠️', title: 'Latency Threshold', getMessage: () => `P95 latency exceeds ${Math.floor(Math.random() * 200) + 200}ms threshold`, service: 'output' },
  ];

  const alerts: Alert[] = [];
  const numAlerts = Math.floor(Math.random() * 3) + 5; // 5-7 alerts

  for (let i = 0; i < numAlerts; i++) {
    const template = alertTemplates[Math.floor(Math.random() * alertTemplates.length)];
    const minutesAgo = i * 3 + Math.floor(Math.random() * 3);

    alerts.push({
      id: `alert-${Date.now()}-${i}`,
      type: template.type,
      icon: template.icon,
      title: template.title,
      message: template.getMessage(),
      timestamp: new Date(Date.now() - minutesAgo * 60000),
      service: template.service,
    });
  }

  return alerts;
}

// Generate cluster info
export function generateClusterInfo(): ClusterInfo {
  const pods = generatePodStatuses();
  const healthyPods = pods.filter(p => p.status === 'running').length;

  return {
    clusterName: 'minikube-prod',
    namespace: 'ez-platform',
    version: '1.28.3',
    nodeCount: 1,
    totalPods: pods.length,
    healthyPods,
  };
}

// Format timestamp for alerts
export function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}
