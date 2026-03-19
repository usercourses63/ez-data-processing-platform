/**
 * Pipeline topology constants for the monitoring dashboard.
 * Defines service positions and connections for the PipelineFlow visualization.
 *
 * Extracted from monitoring-mock-data.ts during mock data removal (Phase 22-02).
 */

import { ServiceConnection } from '../types/monitoring.types';

/**
 * Pipeline connections between services
 *
 * Connection Types:
 * - Kafka Event Flow: Asynchronous message-driven connections
 * - Database Write: Data persistence operations
 */
export const PIPELINE_CONNECTIONS: ServiceConnection[] = [
  // PRIMARY KAFKA EVENT FLOW
  { from: 'datasource', to: 'scheduling' },      // DataSourceCreated/Updated/Deleted Event
  { from: 'scheduling', to: 'filediscovery' },   // FilePollingEvent
  { from: 'filediscovery', to: 'fileprocessor' }, // FileDiscoveredEvent
  { from: 'fileprocessor', to: 'validation' },    // ValidationRequestEvent
  { from: 'validation', to: 'output' },           // ValidationCompletedEvent

  // SIDE FLOWS
  { from: 'validation', to: 'invalidrecords' },   // Database Write (MongoDB)
  { from: 'invalidrecords', to: 'validation' },   // Reprocess Event
];

/**
 * Get service positions for canvas rendering
 *
 * Layout represents correct pipeline flow:
 * DataSourceMgmt -> Scheduling -> FileDiscovery -> FileProcessor -> Validation -> Output
 *                                                                      |
 *                                                              InvalidRecords
 *                                                      (HTTP API <-> Metrics Config)
 */
export function getServicePositions(): Array<{ id: string; name: string; displayName: string; x: number; y: number; icon: string }> {
  return [
    // PRIMARY FLOW (Top to Bottom, then Left to Right)
    { id: 'datasource', name: 'DataSourceManagement', displayName: 'Data Source Mgmt', x: 100, y: 60, icon: '' },
    { id: 'scheduling', name: 'Scheduling', displayName: 'Scheduling', x: 100, y: 220, icon: '' },
    { id: 'filediscovery', name: 'FileDiscovery', displayName: 'File Discovery', x: 280, y: 220, icon: '' },
    { id: 'fileprocessor', name: 'FileProcessor', displayName: 'File Processor', x: 460, y: 220, icon: '' },
    { id: 'validation', name: 'Validation', displayName: 'Validation', x: 640, y: 220, icon: '' },
    { id: 'output', name: 'Output', displayName: 'Output', x: 820, y: 220, icon: '' },

    // SUPPORTING SERVICES (Top row)
    { id: 'metrics', name: 'MetricsConfiguration', displayName: 'Metrics Config', x: 640, y: 60, icon: '' },
    { id: 'invalidrecords', name: 'InvalidRecords', displayName: 'Invalid Records', x: 820, y: 60, icon: '' },
  ];
}

/**
 * Get random connection for particle animation
 */
export function simulateDataFlow(): ServiceConnection {
  return PIPELINE_CONNECTIONS[Math.floor(Math.random() * PIPELINE_CONNECTIONS.length)];
}
