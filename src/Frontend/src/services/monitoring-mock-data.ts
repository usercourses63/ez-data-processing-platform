/**
 * Mock Data Generator for EZ Platform Monitoring Dashboard
 *
 * Generates realistic data simulating the 9 microservices of EZ Platform
 * with metrics based on BusinessMetrics.cs and actual event types.
 */

import {
  ServiceStatus,
  PipelineEvent,
  DashboardMetrics,
  MetricDataPoint,
  ServiceConnection,
  LatencyDistribution,
  SuccessFailureMetrics,
} from '../types/monitoring.types';

/**
 * The 9 EZ Platform Services with actual ports
 */
const EZ_SERVICES: Omit<ServiceStatus, 'cpu' | 'memory' | 'throughput' | 'errorRate' | 'latency' | 'uptime' | 'restarts' | 'queueDepth'>[] = [
  { id: 'datasource', name: 'DataSourceManagement', displayName: 'Data Source Management', status: 'healthy', port: 5001, icon: '🗂️' },
  { id: 'metrics', name: 'MetricsConfiguration', displayName: 'Metrics Configuration', status: 'healthy', port: 5002, icon: '📊' },
  { id: 'validation', name: 'Validation', displayName: 'Validation Service', status: 'healthy', port: 5003, icon: '✓' },
  { id: 'scheduling', name: 'Scheduling', displayName: 'Scheduling Service', status: 'healthy', port: 5004, icon: '⏰' },
  { id: 'invalidrecords', name: 'InvalidRecords', displayName: 'Invalid Records', status: 'healthy', port: 5007, icon: '⚠️' },
  { id: 'fileprocessor', name: 'FileProcessor', displayName: 'File Processor', status: 'healthy', port: 5008, icon: '⚙️' },
  { id: 'output', name: 'Output', displayName: 'Output Service', status: 'healthy', port: 5009, icon: '📤' },
  { id: 'filediscovery', name: 'FileDiscovery', displayName: 'File Discovery', status: 'healthy', port: 5006, icon: '📥' },
];

/**
 * Actual event message templates based on EZ Platform events
 */
const EVENT_TEMPLATES = {
  info: [
    'File discovered: {filename}',
    'Validation completed for batch #{batchId}',
    'Processing batch #{batchId} - {count} records',
    'Output sent to destination: {destination}',
    'Job #{jobId} scheduled for execution',
    'Data enrichment completed for {count} records',
    'Cache hit for file content: {fileId}',
    'Metrics calculated successfully',
    'Health check passed',
    'Connection established to message broker',
  ],
  warn: [
    'High queue depth detected: {count} items',
    'Processing latency exceeds threshold: {latency}ms',
    'Retry attempt {attempt} for batch #{batchId}',
    'Cache miss - loading from source',
    'Memory usage at {percent}%',
    'Slow query detected: {duration}ms',
    'Rate limit approaching for data source {dsId}',
  ],
  error: [
    'Validation failed for {count} records',
    'Failed to process file: {filename}',
    'Connection timeout to {service}',
    'Schema validation error: {error}',
    'Output destination unreachable: {destination}',
    'Message consumption failed: {topic}',
    'Database operation failed: {operation}',
    'File format not supported: {format}',
  ],
  debug: [
    'Received message on topic: {topic}',
    'Query executed in {duration}ms',
    'Cache entry created: {key}',
    'Event published: {eventType}',
    'Correlation ID: {correlationId}',
    'Transaction started: {txId}',
    'Hazelcast cluster member joined',
  ],
};

/**
 * Pipeline connections between services
 */
export const PIPELINE_CONNECTIONS: ServiceConnection[] = [
  { from: 'filediscovery', to: 'fileprocessor' },
  { from: 'scheduling', to: 'fileprocessor' },
  { from: 'fileprocessor', to: 'validation' },
  { from: 'validation', to: 'output' },
  { from: 'datasource', to: 'fileprocessor' },
  { from: 'validation', to: 'invalidrecords' },
  { from: 'fileprocessor', to: 'metrics' },
  { from: 'output', to: 'metrics' },
];

// State for time-series data
let throughputData: MetricDataPoint[] = [];
let latencyData: MetricDataPoint[] = [];
let errorData: MetricDataPoint[] = [];

/**
 * Initialize time-series data with 30 historical points
 */
function initializeTimeSeriesData() {
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * 60000); // 1 minute intervals

    throughputData.push({
      timestamp,
      value: Math.floor(Math.random() * 1000) + 2000, // 2000-3000 records/sec
    });

    latencyData.push({
      timestamp,
      value: Math.floor(Math.random() * 50) + 80, // 80-130ms
    });

    errorData.push({
      timestamp,
      value: Math.random() * 1.5, // 0-1.5%
    });
  }
}

// Initialize on module load
initializeTimeSeriesData();

/**
 * Generate random value within range
 */
function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random status weighted towards 'healthy'
 */
function generateStatus(): 'healthy' | 'warning' | 'error' | 'unknown' {
  const rand = Math.random();
  if (rand < 0.75) return 'healthy';      // 75% healthy
  if (rand < 0.95) return 'warning';      // 20% warning
  if (rand < 0.99) return 'error';        // 4% error
  return 'unknown';                        // 1% unknown
}

/**
 * Generate realistic uptime string
 */
function generateUptime(): string {
  const days = randomInRange(0, 15);
  const hours = randomInRange(0, 23);
  const minutes = randomInRange(0, 59);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Replace template variables in event message
 */
function fillTemplate(template: string): string {
  return template
    .replace('{filename}', `data_${randomInRange(1000, 9999)}.csv`)
    .replace('{batchId}', randomInRange(1000, 9999).toString())
    .replace('{count}', randomInRange(10, 500).toString())
    .replace('{destination}', ['Kafka', 'FileSystem', 'Database', 'API'][randomInRange(0, 3)])
    .replace('{jobId}', randomInRange(100, 999).toString())
    .replace('{fileId}', `file_${randomInRange(1000, 9999)}`)
    .replace('{latency}', randomInRange(150, 500).toString())
    .replace('{attempt}', randomInRange(1, 3).toString())
    .replace('{percent}', randomInRange(70, 95).toString())
    .replace('{duration}', randomInRange(500, 2000).toString())
    .replace('{dsId}', `DS-${randomInRange(100, 200)}`)
    .replace('{service}', EZ_SERVICES[randomInRange(0, EZ_SERVICES.length - 1)].displayName)
    .replace('{error}', ['type_mismatch', 'missing_field', 'format_error', 'schema_validation'][randomInRange(0, 3)])
    .replace('{topic}', ['dataprocessing.validation.completed', 'dataprocessing.global.processingfailed'][randomInRange(0, 1)])
    .replace('{operation}', ['INSERT', 'UPDATE', 'DELETE'][randomInRange(0, 2)])
    .replace('{format}', ['XML', 'YAML', 'AVRO'][randomInRange(0, 2)])
    .replace('{eventType}', ['FileDiscoveredEvent', 'ValidationCompletedEvent', 'FileProcessingFailedEvent'][randomInRange(0, 2)])
    .replace('{correlationId}', `${Math.random().toString(36).substring(7)}-${Date.now()}`)
    .replace('{txId}', `tx_${randomInRange(100000, 999999)}`)
    .replace('{key}', `cache_key_${randomInRange(1000, 9999)}`);
}

/**
 * Generate service status for all 9 EZ Platform services
 */
export function generateServiceStatuses(): ServiceStatus[] {
  return EZ_SERVICES.map(service => {
    const status = generateStatus();
    const hasQueue = ['fileprocessor', 'validation', 'output', 'scheduling'].includes(service.id);

    // Adjust metrics based on status
    let cpuBase = status === 'error' ? 85 : status === 'warning' ? 70 : 45;
    let memoryBase = status === 'error' ? 82 : status === 'warning' ? 68 : 50;
    let latencyBase = status === 'error' ? 300 : status === 'warning' ? 180 : 80;
    let errorRateBase = status === 'error' ? 3 : status === 'warning' ? 1.2 : 0.3;

    return {
      ...service,
      status,
      cpu: randomInRange(cpuBase - 10, cpuBase + 15),
      memory: randomInRange(memoryBase - 10, memoryBase + 15),
      throughput: randomInRange(100, 1500),
      errorRate: Number((Math.random() * errorRateBase).toFixed(2)),
      latency: randomInRange(latencyBase - 20, latencyBase + 40),
      uptime: generateUptime(),
      restarts: randomInRange(0, status === 'error' ? 5 : status === 'warning' ? 2 : 1),
      queueDepth: hasQueue ? randomInRange(5, 150) : undefined,
    };
  });
}

/**
 * Generate pipeline events
 */
export function generatePipelineEvents(count: number): PipelineEvent[] {
  const events: PipelineEvent[] = [];

  for (let i = 0; i < count; i++) {
    const level = (['info', 'info', 'info', 'warn', 'error', 'debug'] as const)[randomInRange(0, 5)]; // Weighted toward info
    const templates = EVENT_TEMPLATES[level];
    const template = templates[randomInRange(0, templates.length - 1)];
    const service = EZ_SERVICES[randomInRange(0, EZ_SERVICES.length - 1)];

    events.push({
      id: `event_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(Date.now() - randomInRange(0, 3600000)), // Last hour
      service: service.displayName,
      level,
      message: fillTemplate(template),
      correlationId: Math.random() > 0.7 ? `corr_${Math.random().toString(36).substring(7)}` : undefined,
    });
  }

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Update time-series data (called on refresh)
 */
function updateTimeSeriesData() {
  const now = new Date();

  // Add new data point
  throughputData.push({
    timestamp: now,
    value: Math.floor(Math.random() * 1000) + 2000,
  });

  latencyData.push({
    timestamp: now,
    value: Math.floor(Math.random() * 50) + 80,
  });

  errorData.push({
    timestamp: now,
    value: Math.random() * 1.5,
  });

  // Keep only last 30 points
  if (throughputData.length > 30) throughputData.shift();
  if (latencyData.length > 30) latencyData.shift();
  if (errorData.length > 30) errorData.shift();
}

/**
 * Generate dashboard metrics
 */
export function generateDashboardMetrics(): DashboardMetrics {
  updateTimeSeriesData();

  const totalThroughput = Math.floor(Math.random() * 1000) + 2500;
  const successCount = randomInRange(9500, 9900);
  const failureCount = randomInRange(100, 500);
  const totalRecords = successCount + failureCount;

  return {
    totalThroughput,
    successRate: Number(((successCount / totalRecords) * 100).toFixed(2)),
    avgLatency: Math.floor(Math.random() * 50) + 100,
    activeJobs: randomInRange(5, 25),
    queueDepth: randomInRange(50, 300),
    errorRate: Number(((failureCount / totalRecords) * 100).toFixed(2)),
    throughputHistory: [...throughputData],
    latencyHistory: [...latencyData],
    errorHistory: [...errorData],
  };
}

/**
 * Get random connection for particle animation
 */
export function simulateDataFlow(): ServiceConnection {
  return PIPELINE_CONNECTIONS[randomInRange(0, PIPELINE_CONNECTIONS.length - 1)];
}

/**
 * Generate latency distribution percentiles
 */
export function generateLatencyDistribution(): LatencyDistribution {
  return {
    p50: randomInRange(40, 60),
    p75: randomInRange(70, 90),
    p90: randomInRange(110, 140),
    p95: randomInRange(160, 200),
    p99: randomInRange(250, 350),
  };
}

/**
 * Generate success/failure metrics for donut chart
 */
export function generateSuccessFailureMetrics(): SuccessFailureMetrics {
  const successCount = randomInRange(9500, 9900);
  const failureCount = randomInRange(100, 500);
  const total = successCount + failureCount;

  return {
    successCount,
    failureCount,
    successRate: Number(((successCount / total) * 100).toFixed(2)),
  };
}

/**
 * Get service positions for canvas rendering
 */
export function getServicePositions(): Array<{ id: string; name: string; displayName: string; x: number; y: number; icon: string }> {
  return [
    { id: 'filediscovery', name: 'FileDiscovery', displayName: 'File Discovery', x: 50, y: 150, icon: '📥' },
    { id: 'scheduling', name: 'Scheduling', displayName: 'Scheduling', x: 50, y: 300, icon: '⏰' },
    { id: 'fileprocessor', name: 'FileProcessor', displayName: 'File Processor', x: 300, y: 225, icon: '⚙️' },
    { id: 'validation', name: 'Validation', displayName: 'Validation', x: 550, y: 225, icon: '✓' },
    { id: 'output', name: 'Output', displayName: 'Output', x: 800, y: 225, icon: '📤' },
    { id: 'datasource', name: 'DataSourceManagement', displayName: 'Data Source Mgmt', x: 300, y: 50, icon: '🗂️' },
    { id: 'metrics', name: 'MetricsConfiguration', displayName: 'Metrics Config', x: 550, y: 50, icon: '📊' },
    { id: 'invalidrecords', name: 'InvalidRecords', displayName: 'Invalid Records', x: 800, y: 50, icon: '⚠️' },
  ];
}
