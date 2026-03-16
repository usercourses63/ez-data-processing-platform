/**
 * File-simulator REST API client for discovery and dynamic server creation.
 * Used by protocol tests to interact with the file-simulator cluster.
 *
 * Environment: FILE_SIMULATOR_URL defaults to http://172.17.89.141:30500
 * (NodePort on Hyper-V minikube cluster - NOT port-forward, which hangs)
 */
import { APIRequestContext } from '@playwright/test';

export const SIMULATOR_BASE = process.env.FILE_SIMULATOR_URL || 'http://172.17.89.141:30500';

// ============================================================
// Type definitions
// ============================================================

export interface SimulatorCredentials {
  username: string;
  password: string;
  note?: string;
}

export interface SimulatorServer {
  name: string;
  podName: string;
  protocol: string;
  serviceName: string;
  clusterIp: string;
  port: number;
  nodePort: number;
  podStatus: string;
  podReady: boolean;
  isDynamic: boolean;
  credentials?: SimulatorCredentials;
}

export interface SimulatorServerEndpoint {
  name: string;
  protocol: string;
  host: string;
  port: number;
  clusterIp: string;
  clusterPort: number;
  serviceName: string;
  isDynamic: boolean;
  status: string;
  credentials?: SimulatorCredentials;
}

export interface SimulatorConnectionInfo {
  hostname: string;
  servers: SimulatorServerEndpoint[];
}

// ============================================================
// API functions
// ============================================================

/**
 * Check file-simulator health
 */
export async function getSimulatorHealth(request: APIRequestContext): Promise<boolean> {
  try {
    const response = await request.get(`${SIMULATOR_BASE}/health`);
    return response.ok();
  } catch (error) {
    console.error(`[simulator-client] Health check failed: ${error}`);
    return false;
  }
}

/**
 * Get all servers registered in the file-simulator
 */
export async function getSimulatorServers(request: APIRequestContext): Promise<SimulatorServer[]> {
  const response = await request.get(`${SIMULATOR_BASE}/api/servers`);
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[simulator-client] GET /api/servers failed (${response.status()}): ${body}`);
    throw new Error(`Failed to get simulator servers: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Get connection info with external host and NodePort details
 */
export async function getConnectionInfo(request: APIRequestContext): Promise<SimulatorConnectionInfo> {
  const response = await request.get(`${SIMULATOR_BASE}/api/connection-info?format=json`);
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[simulator-client] GET /api/connection-info failed (${response.status()}): ${body}`);
    throw new Error(`Failed to get connection info: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Create a dynamic FTP server on the file-simulator
 */
export async function createDynamicFtp(
  request: APIRequestContext,
  name: string,
  username: string = 'ftpuser',
  password: string = 'ftppass123'
): Promise<SimulatorServer> {
  const response = await request.post(`${SIMULATOR_BASE}/api/servers/ftp`, {
    data: { name, username, password },
  });
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[simulator-client] POST /api/servers/ftp failed (${response.status()}): ${body}`);
    throw new Error(`Failed to create dynamic FTP: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Create a dynamic SFTP server on the file-simulator
 */
export async function createDynamicSftp(
  request: APIRequestContext,
  name: string,
  username: string = 'sftpuser',
  password: string = 'sftppass123'
): Promise<SimulatorServer> {
  const response = await request.post(`${SIMULATOR_BASE}/api/servers/sftp`, {
    data: { name, username, password },
  });
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[simulator-client] POST /api/servers/sftp failed (${response.status()}): ${body}`);
    throw new Error(`Failed to create dynamic SFTP: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Create a dynamic NAS server on the file-simulator
 */
export async function createDynamicNas(
  request: APIRequestContext,
  name: string,
  directory: string = '/data'
): Promise<SimulatorServer> {
  const response = await request.post(`${SIMULATOR_BASE}/api/servers/nas`, {
    data: { name, directory },
  });
  if (!response.ok()) {
    const body = await response.text();
    console.error(`[simulator-client] POST /api/servers/nas failed (${response.status()}): ${body}`);
    throw new Error(`Failed to create dynamic NAS: ${response.status()} ${body}`);
  }
  return response.json();
}

/**
 * Delete a dynamic server from the file-simulator (if supported).
 * Fails silently if the simulator does not support deletion.
 */
export async function deleteSimulatorServer(
  request: APIRequestContext,
  name: string
): Promise<void> {
  try {
    const response = await request.delete(`${SIMULATOR_BASE}/api/servers/${name}`);
    if (!response.ok() && response.status() !== 404) {
      const body = await response.text();
      console.warn(`[simulator-client] DELETE /api/servers/${name} returned ${response.status()}: ${body}`);
    }
  } catch (error) {
    // Delete may not be supported - fail silently
    console.warn(`[simulator-client] DELETE /api/servers/${name} failed (may not be supported): ${error}`);
  }
}

/**
 * Filter simulator servers by protocol
 */
export function filterServersByProtocol(servers: SimulatorServer[], protocol: string): SimulatorServer[] {
  return servers.filter((s) => s.protocol.toLowerCase() === protocol.toLowerCase());
}
