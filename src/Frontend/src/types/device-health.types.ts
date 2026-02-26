/**
 * TypeScript interfaces for Device Health Status API
 * v0.2.0: Device Health Monitoring (Phase 15)
 *
 * CRITICAL: Uses PascalCase property names to match backend JSON serialization
 * (PropertyNamingPolicy = null). See commit 18610e0 for context.
 */

/**
 * Device health status values
 */
export type DeviceHealthStatus = 'Healthy' | 'Degraded' | 'Down' | 'Disabled';

/**
 * Individual device health information
 */
export interface DeviceHealthInfo {
  DeviceId: string;
  DeviceName: string;
  DeviceType: string;
  DeviceSubType?: string;
  Role: string;
  Status: DeviceHealthStatus;
  LatencyMs?: number;
  LastCheckTime?: string;
  ErrorMessage?: string;
  UptimePercentage24h: number;
  IsActive: boolean;
}

/**
 * Aggregated health status response from GET /api/v1/health-status
 */
export interface DeviceHealthStatusResponse {
  TotalDevices: number;
  HealthyCount: number;
  DegradedCount: number;
  DownCount: number;
  DisabledCount: number;
  NasDevices: DeviceHealthInfo[];
  AdminServers: DeviceHealthInfo[];
}
