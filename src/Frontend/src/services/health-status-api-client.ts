/**
 * API Client for Device Health Status
 * v0.2.0: Device Health Monitoring (Phase 15)
 *
 * Fetches real health data from GET /api/v1/health-status
 * with React Query polling every 15 seconds.
 */

import { useQuery } from '@tanstack/react-query';
import { DeviceHealthStatusResponse } from '../types/device-health.types';

const API_BASE_URL = '';

/**
 * Fetch device health status from the backend API
 * @returns Aggregated device health status for all NAS devices and AdminServers
 */
export const getDeviceHealthStatus = async (): Promise<DeviceHealthStatusResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/health-status`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error fetching device health status');
  }

  return response.json();
};

/**
 * React Query hook for device health status with auto-polling
 * - Polls every 15 seconds
 * - Only refreshes when tab is visible
 * - Data considered fresh for 10 seconds
 */
export const useDeviceHealthStatus = () => {
  return useQuery<DeviceHealthStatusResponse>({
    queryKey: ['device-health-status'],
    queryFn: getDeviceHealthStatus,
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
    staleTime: 10000,
  });
};
