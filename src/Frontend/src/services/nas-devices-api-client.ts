/**
 * API Client for managing NAS devices
 * v0.2.0: NAS/NFS Architecture Support
 */

const API_BASE_URL = '';

// NAS device role enum
export type NasDeviceRole = 'Input' | 'Output' | 'Backup' | 'Both';

// Main NasDevice interface
export interface NasDevice {
  ID: string;
  Name: string;
  Description?: string;
  Host: string;
  Port: number;
  ExportPath: string;
  Role: NasDeviceRole;
  StorageCapacity: string;
  AccessMode: string;
  ReclaimPolicy: string;
  MountOptions: string[];
  IsPvCreated: boolean;
  IsPvcBound: boolean;
  LastProvisionedAt?: string;
  ProvisioningError?: string;
  LastConnectionTest?: string;
  LastConnectionSuccess?: boolean;
  LastConnectionError?: string;
  CreatedAt: string;
  UpdatedAt: string;
  IsActive: boolean;
  IsDeleted: boolean;
  Version: number;
}

// Request interfaces
export interface CreateNasDeviceRequest {
  Name: string;
  Description?: string;
  Host: string;
  Port?: number;
  ExportPath?: string;
  Role: NasDeviceRole;
  StorageCapacity?: string;
  AccessMode?: string;
  ReclaimPolicy?: string;
  MountOptions?: string[];
}

export interface UpdateNasDeviceRequest extends Partial<CreateNasDeviceRequest> {
  Version?: number;
  IsActive?: boolean;
}

export interface ProvisionNasDeviceRequest {
  Namespace?: string;
  CreatePv?: boolean;
  CreatePvc?: boolean;
  WaitForBinding?: boolean;
  TimeoutSeconds?: number;
}

// Response interfaces
export interface NasDeviceProvisionResult {
  Success: boolean;
  PvCreated: boolean;
  PvcCreated: boolean;
  PvcBound: boolean;
  PvName?: string;
  PvcName?: string;
  ErrorMessage?: string;
  DurationMs: number;
}

export interface NasDeviceConnectionTestResult {
  Success: boolean;
  Message?: string;
  ErrorMessage?: string;
  DurationMs: number;
}

// Query keys for React Query
export const nasDeviceQueryKeys = {
  all: ['nasDevices'] as const,
  list: () => [...nasDeviceQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...nasDeviceQueryKeys.all, 'detail', id] as const,
  byRole: (role: NasDeviceRole) => [...nasDeviceQueryKeys.all, 'role', role] as const,
};

/**
 * Get all NAS devices
 * @param includeDeleted - Include soft-deleted devices
 * @returns List of NAS devices
 */
export const getNasDevices = async (includeDeleted = false): Promise<NasDevice[]> => {
  const url = includeDeleted
    ? `${API_BASE_URL}/api/v1/nasdevices?includeDeleted=true`
    : `${API_BASE_URL}/api/v1/nasdevices`;

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error fetching NAS devices');
  }

  return response.json();
};

/**
 * Get a NAS device by ID
 * @param id - NAS device ID
 * @returns NAS device
 */
export const getNasDeviceById = async (id: string): Promise<NasDevice> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/nasdevices/${id}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error fetching NAS device');
  }

  return response.json();
};

/**
 * Get NAS devices by role
 * @param role - NAS device role
 * @returns List of NAS devices with the specified role
 */
export const getNasDevicesByRole = async (role: NasDeviceRole): Promise<NasDevice[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/nasdevices/by-role/${role}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error fetching NAS devices by role');
  }

  return response.json();
};

/**
 * Create a new NAS device
 * @param request - NAS device data
 * @returns Created NAS device
 */
export const createNasDevice = async (request: CreateNasDeviceRequest): Promise<NasDevice> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/nasdevices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error creating NAS device');
  }

  return response.json();
};

/**
 * Update an existing NAS device
 * @param id - NAS device ID
 * @param request - Updated NAS device data
 * @returns Updated NAS device
 */
export const updateNasDevice = async (id: string, request: UpdateNasDeviceRequest): Promise<NasDevice> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/nasdevices/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(request),
  });

  if (response.status === 409) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || '\u05d4\u05e8\u05e9\u05d5\u05de\u05d4 \u05e9\u05d5\u05e0\u05ea\u05d4 \u05e2\u05dc \u05d9\u05d3\u05d9 \u05de\u05e9\u05ea\u05de\u05e9 \u05d0\u05d7\u05e8. \u05d0\u05e0\u05d0 \u05e8\u05e2\u05e0\u05df \u05d5\u05e0\u05e1\u05d4 \u05e9\u05d5\u05d1.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error updating NAS device');
  }

  return response.json();
};

/**
 * Delete a NAS device (soft delete)
 * @param id - NAS device ID
 */
export const deleteNasDevice = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/nasdevices/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error deleting NAS device');
  }
};

/**
 * Provision Kubernetes resources (PV/PVC) for a NAS device
 * @param id - NAS device ID
 * @param request - Provisioning options
 * @returns Provisioning result
 */
export const provisionNasDevice = async (
  id: string,
  request?: ProvisionNasDeviceRequest
): Promise<NasDeviceProvisionResult> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/nasdevices/${id}/provision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(request || {}),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error provisioning NAS device');
  }

  return response.json();
};

/**
 * Deprovision Kubernetes resources for a NAS device
 * @param id - NAS device ID
 * @param namespace - Optional namespace (defaults to ez-platform)
 */
export const deprovisionNasDevice = async (id: string, namespace?: string): Promise<void> => {
  const url = namespace
    ? `${API_BASE_URL}/api/v1/nasdevices/${id}/deprovision?namespace=${encodeURIComponent(namespace)}`
    : `${API_BASE_URL}/api/v1/nasdevices/${id}/deprovision`;

  const response = await fetch(url, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error deprovisioning NAS device');
  }
};

/**
 * Test connection to a NAS device (verifies PVC binding status)
 * @param id - NAS device ID
 * @returns Connection test result
 */
export const testNasDeviceConnection = async (id: string): Promise<NasDeviceConnectionTestResult> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/nasdevices/${id}/test-connection`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Error testing NAS device connection');
  }

  return response.json();
};
