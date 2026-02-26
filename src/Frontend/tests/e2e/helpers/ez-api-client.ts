/**
 * EZ backend API client for servers, NAS devices, and file operations.
 * All request payloads use PascalCase (backend convention: PropertyNamingPolicy = null).
 *
 * Environment: EZ_API_URL defaults to http://localhost:5001
 * (port-forward works for EZ cluster since it's the local minikube)
 */
import { APIRequestContext, expect } from '@playwright/test';

export const EZ_API_BASE = process.env.EZ_API_URL || 'http://localhost:5001';

// ============================================================
// Type definitions (PascalCase matching backend)
// ============================================================

// Backend enum ServerDirection: Input=0, Output=1, Both=2
// No JsonStringEnumConverter registered, so API expects numeric values
export enum ServerDirection {
  Input = 0,
  Output = 1,
  Both = 2,
}

export interface AdminServerPayload {
  Name: string;
  Description?: string;
  ServerType: string;
  Direction: ServerDirection;
  IsActive?: boolean;
  Host?: string;
  Port?: number;
  BasePath?: string;
  CredentialSecretRef?: string;
  KafkaConfig?: {
    BootstrapServers: string;
    SecurityProtocol?: string;
    DefaultConsumerGroup?: string;
  };
  TypeSpecificConfig?: Record<string, unknown>;
  ConnectionTimeoutSeconds?: number;
  RetryCount?: number;
}

export interface AdminServerResponse {
  ID: string;
  Name: string;
  ServerType: string;
  Direction: string;
  IsActive: boolean;
  Host?: string;
  Port?: number;
  BasePath?: string;
}

// Backend enum NasDeviceRole: Input=0, Output=1, Backup=2, Both=3
export enum NasDeviceRole {
  Input = 0,
  Output = 1,
  Backup = 2,
  Both = 3,
}

export interface NasDevicePayload {
  Name: string;
  Host: string;
  Port?: number;
  ExportPath: string;
  MountPath?: string;
  SubPath?: string;
  Role: NasDeviceRole;
  Description?: string;
  MountOptions?: string[];
}

export interface NasDeviceResponse {
  ID: string;
  Name: string;
  Host: string;
  Port: number;
  ExportPath: string;
  MountPath: string;
  Role: string;
  IsProvisioned: boolean;
  IsPvcBound: boolean;
  IsPvCreated: boolean;
}

export interface ProvisionRequest {
  Namespace?: string;
  CreatePv?: boolean;
  CreatePvc?: boolean;
  WaitForBinding?: boolean;
  TimeoutSeconds?: number;
}

export interface DiscoveredFile {
  FullPath: string;
  FileName: string;
  SizeBytes: number;
  LastModifiedUtc: string;
  IsDirectory: boolean;
  ContentType?: string;
}

export interface ServerConnectionTestResult {
  Success: boolean;
  ErrorMessage?: string;
  ConnectionTimeMs: number;
}

// ============================================================
// Server CRUD
// ============================================================

/**
 * Create an admin server in EZ
 */
export async function createAdminServer(
  request: APIRequestContext,
  server: AdminServerPayload
): Promise<AdminServerResponse> {
  const payload = {
    ConnectionTimeoutSeconds: 30,
    RetryCount: 3,
    IsActive: true,
    ...server,
  };

  const response = await request.post(`${EZ_API_BASE}/api/v1/servers`, {
    data: payload,
  });

  if (!response.ok()) {
    const body = await response.text();
    console.error(`[ez-api] POST /api/v1/servers failed (${response.status()}): ${body}`);
    console.error(`[ez-api] Request payload: ${JSON.stringify(payload)}`);
    throw new Error(`Failed to create server: ${response.status()} ${body}`);
  }

  return response.json();
}

/**
 * Get all servers
 */
export async function getServers(
  request: APIRequestContext,
  includeInactive = false
): Promise<AdminServerResponse[]> {
  const response = await request.get(
    `${EZ_API_BASE}/api/v1/servers?includeInactive=${includeInactive}`
  );
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[ez-api] GET /api/v1/servers failed (${response.status()}): ${body}`);
    throw new Error(`Failed to get servers: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Get a server by ID
 */
export async function getServerById(
  request: APIRequestContext,
  serverId: string
): Promise<AdminServerResponse> {
  const response = await request.get(`${EZ_API_BASE}/api/v1/servers/${serverId}`);
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[ez-api] GET /api/v1/servers/${serverId} failed (${response.status()}): ${body}`);
    throw new Error(`Failed to get server: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Delete a server from EZ
 */
export async function deleteServer(
  request: APIRequestContext,
  serverId: string
): Promise<void> {
  const response = await request.delete(`${EZ_API_BASE}/api/v1/servers/${serverId}`);
  if (!response.ok() && response.status() !== 404) {
    const body = await response.text();
    console.error(`[ez-api] DELETE /api/v1/servers/${serverId} failed (${response.status()}): ${body}`);
    throw new Error(`Failed to delete server: ${response.status()} ${body}`);
  }
}

/**
 * Test connection to a server
 */
export async function testServerConnection(
  request: APIRequestContext,
  serverId: string
): Promise<ServerConnectionTestResult> {
  const response = await request.post(
    `${EZ_API_BASE}/api/v1/servers/${serverId}/test-connection`
  );
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[ez-api] POST /api/v1/servers/${serverId}/test-connection failed (${response.status()}): ${body}`);
    throw new Error(`Failed to test connection: ${response.status()} ${body}`);
  }
  return response.json();
}

// ============================================================
// NAS Device CRUD
// ============================================================

/**
 * Create a NAS device in EZ
 */
export async function createNasDevice(
  request: APIRequestContext,
  device: NasDevicePayload
): Promise<NasDeviceResponse> {
  const response = await request.post(`${EZ_API_BASE}/api/v1/nasdevices`, {
    data: device,
  });
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[ez-api] POST /api/v1/nasdevices failed (${response.status()}): ${body}`);
    console.error(`[ez-api] Request payload: ${JSON.stringify(device)}`);
    throw new Error(`Failed to create NAS device: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Get all NAS devices
 */
export async function getNasDevices(request: APIRequestContext): Promise<NasDeviceResponse[]> {
  const response = await request.get(`${EZ_API_BASE}/api/v1/nasdevices`);
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[ez-api] GET /api/v1/nasdevices failed (${response.status()}): ${body}`);
    throw new Error(`Failed to get NAS devices: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Provision a NAS device (create PV/PVC)
 */
export async function provisionNasDevice(
  request: APIRequestContext,
  deviceId: string,
  options: ProvisionRequest = {}
): Promise<unknown> {
  const payload: ProvisionRequest = {
    Namespace: 'ez-platform',
    CreatePv: true,
    CreatePvc: true,
    WaitForBinding: true,
    TimeoutSeconds: 60,
    ...options,
  };

  const response = await request.post(
    `${EZ_API_BASE}/api/v1/nasdevices/${deviceId}/provision`,
    { data: payload }
  );
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[ez-api] POST /api/v1/nasdevices/${deviceId}/provision failed (${response.status()}): ${body}`);
    throw new Error(`Failed to provision NAS device: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Test NAS device connection
 */
export async function testNasConnection(
  request: APIRequestContext,
  deviceId: string
): Promise<unknown> {
  const response = await request.post(
    `${EZ_API_BASE}/api/v1/nasdevices/${deviceId}/test-connection`
  );
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[ez-api] POST /api/v1/nasdevices/${deviceId}/test-connection failed (${response.status()}): ${body}`);
    throw new Error(`Failed to test NAS connection: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Delete a NAS device
 */
export async function deleteNasDevice(
  request: APIRequestContext,
  deviceId: string
): Promise<void> {
  const response = await request.delete(`${EZ_API_BASE}/api/v1/nasdevices/${deviceId}`);
  if (!response.ok() && response.status() !== 404) {
    const body = await response.text();
    console.error(`[ez-api] DELETE /api/v1/nasdevices/${deviceId} failed (${response.status()}): ${body}`);
    throw new Error(`Failed to delete NAS device: ${response.status()} ${body}`);
  }
}

/**
 * Deprovision a NAS device (remove mounts, delete PVC/PV)
 */
export async function deprovisionNasDevice(
  request: APIRequestContext,
  deviceId: string,
  namespace = 'ez-platform'
): Promise<void> {
  const response = await request.post(
    `${EZ_API_BASE}/api/v1/nasdevices/${deviceId}/deprovision?namespace=${namespace}`
  );
  if (!response.ok() && response.status() !== 404) {
    const body = await response.text();
    console.error(`[ez-api] POST /api/v1/nasdevices/${deviceId}/deprovision failed (${response.status()}): ${body}`);
    throw new Error(`Failed to deprovision NAS device: ${response.status()} ${body}`);
  }
}

/**
 * Wait for the datasource-management deployment to complete its rollout after
 * provisioning a NAS device (which patches the deployment with a new volume mount,
 * triggering a pod restart).
 *
 * Strategy: K8s rolling update keeps old pod alive until new pod is Ready.
 * Simple health polling always hits the old pod (returns 200).
 * Instead, we wait for health to go DOWN (old pod terminating) then come back UP
 * (new pod ready). If health never goes down within a window, the rollout
 * may have completed very fast — fall through to mount verification.
 */
export async function waitForDeploymentReady(
  request: APIRequestContext,
  timeoutMs = 120000,
  pollIntervalMs = 3000
): Promise<boolean> {
  console.log(`[ez-api] Waiting for deployment rollout (up to ${timeoutMs / 1000}s)...`);

  const startTime = Date.now();

  // Phase 1: Wait for health to go DOWN (old pod terminating)
  // Give it up to 30s — if it never goes down, the rollout may be instant
  const downDeadline = startTime + 30000;
  let sawDown = false;

  while (Date.now() < downDeadline) {
    try {
      const response = await request.get(`${EZ_API_BASE}/health`, { timeout: 3000 });
      if (!response.ok()) {
        sawDown = true;
        console.log(`[ez-api] Health DOWN (${response.status()}) — rollout in progress`);
        break;
      }
    } catch {
      sawDown = true;
      console.log(`[ez-api] Health DOWN (connection refused) — rollout in progress`);
      break;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  if (!sawDown) {
    console.log(`[ez-api] Health never went down — rollout may have completed quickly or not started yet`);
  }

  // Phase 2: Wait for health to come back UP (new pod ready)
  const maxAttempts = Math.ceil((timeoutMs - (Date.now() - startTime)) / pollIntervalMs);
  let consecutiveOk = 0;
  const requiredConsecutive = 2;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await request.get(`${EZ_API_BASE}/health`, { timeout: 5000 });
      if (response.ok()) {
        consecutiveOk++;
        console.log(`[ez-api] Health UP (${consecutiveOk}/${requiredConsecutive})`);
        if (consecutiveOk >= requiredConsecutive) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`[ez-api] Deployment ready after ${elapsed}s`);
          return true;
        }
      } else {
        consecutiveOk = 0;
      }
    } catch {
      consecutiveOk = 0;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  console.warn(`[ez-api] Deployment rollout timed out after ${timeoutMs / 1000}s`);
  return false;
}

/**
 * Wait for a NAS mount path to be accessible inside the running pod.
 * Creates a temporary folder-type AdminServer pointing to the mount path,
 * polls TestConnection until it reports the directory exists, then cleans up.
 *
 * This is the definitive check that the new pod (with the NFS volume mount)
 * is serving requests — not the old pod from before the rollout.
 */
export async function waitForMountReady(
  request: APIRequestContext,
  mountPath: string,
  timeoutMs = 90000,
  pollIntervalMs = 5000
): Promise<boolean> {
  console.log(`[ez-api] Verifying mount path accessible: ${mountPath} (up to ${timeoutMs / 1000}s)...`);

  // Create a temporary folder server pointing to the mount path
  const tempServer = await createAdminServer(request, {
    Name: `mount-check-${Date.now()}`,
    ServerType: 'folder',
    Direction: ServerDirection.Both,
    Host: 'localhost',
    Port: 0,
    BasePath: mountPath,
  });

  const startTime = Date.now();
  const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);

  try {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await testServerConnection(request, tempServer.ID);
        if (result.Success) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`[ez-api] Mount path verified after ${elapsed}s: ${mountPath}`);
          return true;
        }
        console.log(`[ez-api] Mount check ${i + 1}/${maxAttempts}: not accessible yet (${result.ErrorMessage})`);
      } catch {
        console.log(`[ez-api] Mount check ${i + 1}/${maxAttempts}: request failed (pod restarting?)`);
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    console.warn(`[ez-api] Mount path verification timed out after ${timeoutMs / 1000}s: ${mountPath}`);
    return false;
  } finally {
    // Clean up temporary server
    try {
      await deleteServer(request, tempServer.ID);
    } catch { /* ignore cleanup errors */ }
  }
}

// ============================================================
// File Operations (NEW endpoints from 15.1-01)
// ============================================================

/**
 * List files on a server via the file operations proxy
 */
export async function listFiles(
  request: APIRequestContext,
  serverId: string,
  path?: string,
  pattern?: string
): Promise<DiscoveredFile[]> {
  const response = await request.post(
    `${EZ_API_BASE}/api/v1/file-operations/${serverId}/list`,
    {
      data: {
        Path: path || null,
        Pattern: pattern || '*',
      },
    }
  );
  if (!response.ok()) {
    const body = await response.text();
    console.error(
      `[ez-api] POST /api/v1/file-operations/${serverId}/list failed (${response.status()}): ${body}`
    );
    throw new Error(`Failed to list files: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Read a file from a server via the file operations proxy.
 * Returns raw bytes as a Buffer.
 */
export async function readFile(
  request: APIRequestContext,
  serverId: string,
  filePath: string
): Promise<Buffer> {
  const response = await request.post(
    `${EZ_API_BASE}/api/v1/file-operations/${serverId}/read`,
    {
      data: {
        FilePath: filePath,
      },
    }
  );
  if (!response.ok()) {
    const body = await response.text();
    console.error(
      `[ez-api] POST /api/v1/file-operations/${serverId}/read failed (${response.status()}): ${body}`
    );
    throw new Error(`Failed to read file: ${response.status()} ${body}`);
  }
  return Buffer.from(await response.body());
}

/**
 * Write a file to a server via the file operations proxy.
 * Content is base64-encoded before sending.
 */
export async function writeFile(
  request: APIRequestContext,
  serverId: string,
  filePath: string,
  content: Buffer
): Promise<void> {
  const response = await request.post(
    `${EZ_API_BASE}/api/v1/file-operations/${serverId}/write`,
    {
      data: {
        FilePath: filePath,
        Content: content.toString('base64'),
      },
      timeout: 60000,
    }
  );
  if (!response.ok()) {
    const body = await response.text();
    console.error(
      `[ez-api] POST /api/v1/file-operations/${serverId}/write failed (${response.status()}): ${body}`
    );
    throw new Error(`Failed to write file: ${response.status()} ${body}`);
  }
}
