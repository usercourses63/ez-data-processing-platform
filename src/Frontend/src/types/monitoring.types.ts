/**
 * TypeScript interfaces for EZ Platform Monitoring Dashboard
 *
 * These types define the structure for monitoring data including:
 * - Service health status
 * - Pipeline events
 * - Performance metrics
 * - Chart data points
 */

/**
 * Service health status for each microservice
 */
export interface ServiceStatus {
  id: string;
  name: string;
  displayName: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  port: number;
  icon: string;

  // Health metrics
  cpu: number;           // 0-100
  memory: number;        // 0-100
  throughput: number;    // items/sec
  errorRate: number;     // percentage
  latency: number;       // milliseconds

  // Additional details
  uptime: string;        // e.g., "5d 3h"
  restarts: number;
  queueDepth?: number;   // Optional for services that have queues
}

/**
 * Pipeline event log entry
 */
export interface PipelineEvent {
  id: string;
  timestamp: Date;
  service: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  correlationId?: string;
}

/**
 * Time-series data point for charts
 */
export interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

/**
 * Dashboard top-level metrics and KPIs
 */
export interface DashboardMetrics {
  // Top-level KPIs
  totalThroughput: number;        // records/sec
  successRate: number;            // percentage
  avgLatency: number;             // ms
  activeJobs: number;
  queueDepth: number;
  errorRate: number;              // percentage

  // Time series data for charts (last 30 data points)
  throughputHistory: MetricDataPoint[];
  latencyHistory: MetricDataPoint[];
  errorHistory: MetricDataPoint[];
}

/**
 * Connection between services in pipeline visualization
 */
export interface ServiceConnection {
  from: string;  // service id
  to: string;    // service id
}

/**
 * Animated particle for data flow visualization
 */
export interface DataParticle {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;  // 0-1
  startTime: number;
}

/**
 * Latency percentile distribution
 */
export interface LatencyDistribution {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

/**
 * Success/failure breakdown for donut chart
 */
export interface SuccessFailureMetrics {
  successCount: number;
  failureCount: number;
  successRate: number;  // percentage
}
