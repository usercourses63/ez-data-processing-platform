/**
 * API Client for managing admin file servers (Input/Output)
 * v0.2.0: External File Access Support
 */

const API_BASE_URL = '';

// Server direction enum
export type ServerDirection = 'Input' | 'Output' | 'Both';

// Kafka-specific configuration
export interface KafkaServerConfig {
  BootstrapServers: string;
  SecurityProtocol: string;
  SaslMechanism?: string;
  EnableSsl: boolean;
  SslCaLocation?: string;
  AcksRequired: number;
  DefaultConsumerGroup?: string;
}

// Main AdminServer interface
export interface AdminServer {
  ID: string;
  Name: string;
  Description?: string;
  ServerType: string;
  Direction: ServerDirection;
  IsActive: boolean;
  Host?: string;
  Port?: number;
  BasePath?: string;
  CredentialSecretRef?: string;
  KafkaConfig?: KafkaServerConfig;
  TypeSpecificConfig?: Record<string, unknown>;
  ConnectionTimeoutSeconds: number;
  RetryCount: number;
  LastConnectionTest?: string;
  LastConnectionSuccess?: boolean;
  CreatedAt: string;
  UpdatedAt: string;
}

// Request interfaces
export interface CreateServerRequest {
  Name: string;
  Description?: string;
  ServerType: string;
  Direction: ServerDirection;
  Host?: string;
  Port?: number;
  BasePath?: string;
  CredentialSecretRef?: string;
  KafkaConfig?: KafkaServerConfig;
  TypeSpecificConfig?: Record<string, unknown>;
  ConnectionTimeoutSeconds?: number;
  RetryCount?: number;
}

export interface UpdateServerRequest {
  Name: string;
  Description?: string;
  ServerType: string;
  Direction: ServerDirection;
  IsActive: boolean;
  Host?: string;
  Port?: number;
  BasePath?: string;
  CredentialSecretRef?: string;
  KafkaConfig?: KafkaServerConfig;
  TypeSpecificConfig?: Record<string, unknown>;
  ConnectionTimeoutSeconds?: number;
  RetryCount?: number;
}

// Connection test result
export interface ServerConnectionTestResult {
  Success: boolean;
  ErrorMessage?: string;
  TestDuration: string;
  TestedAt: string;
}

// Server type definition
export interface ServerTypeDefinition {
  Type: string;
  DisplayName: string;
  SupportsInput: boolean;
  SupportsOutput: boolean;
  DefaultPort?: number;
  RequiredFields: string[];
}

/**
 * Get all servers
 * @returns List of all servers
 */
export const getAllServers = async (): Promise<AdminServer[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה באחזור שרתים');
  }

  return response.json();
};

/**
 * Get input servers only
 * @returns List of servers that support input
 */
export const getInputServers = async (): Promise<AdminServer[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers/input`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה באחזור שרתי קלט');
  }

  return response.json();
};

/**
 * Get output servers only
 * @returns List of servers that support output
 */
export const getOutputServers = async (): Promise<AdminServer[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers/output`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה באחזור שרתי פלט');
  }

  return response.json();
};

/**
 * Get a server by ID
 * @param id - Server ID
 * @returns Server
 */
export const getServerById = async (id: string): Promise<AdminServer> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה באחזור שרת');
  }

  return response.json();
};

/**
 * Create a new server
 * @param server - Server data
 * @returns Created server
 */
export const createServer = async (server: CreateServerRequest): Promise<AdminServer> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(server),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה ביצירת שרת');
  }

  return response.json();
};

/**
 * Update an existing server
 * @param id - Server ID
 * @param server - Updated server data
 * @returns Updated server
 */
export const updateServer = async (id: string, server: UpdateServerRequest): Promise<AdminServer> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(server),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה בעדכון שרת');
  }

  return response.json();
};

/**
 * Delete a server (soft delete)
 * @param id - Server ID
 */
export const deleteServer = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה במחיקת שרת');
  }
};

/**
 * Test connection to a server
 * @param id - Server ID
 * @returns Connection test result
 */
export const testServerConnection = async (id: string): Promise<ServerConnectionTestResult> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers/${id}/test-connection`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה בבדיקת חיבור');
  }

  return response.json();
};

/**
 * Toggle server active status
 * @param id - Server ID
 * @param isActive - New active status
 * @returns Updated server
 */
export const toggleServerActive = async (id: string, isActive: boolean): Promise<AdminServer> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers/${id}/toggle-active?isActive=${isActive}`, {
    method: 'PATCH',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה בשינוי סטטוס שרת');
  }

  return response.json();
};

/**
 * Get usage count for a server (number of datasources using it)
 * @param id - Server ID
 * @returns Usage count
 */
export const getServerUsageCount = async (id: string): Promise<number> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers/${id}/usage-count`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה בקבלת מידע על שימוש');
  }

  return response.json();
};

/**
 * Get available server types with their direction support
 * @returns List of server type definitions
 */
export const getServerTypes = async (): Promise<ServerTypeDefinition[]> => {
  const response = await fetch(`${API_BASE_URL}/api/v1/servers/types`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'שגיאה באחזור סוגי שרתים');
  }

  return response.json();
};

// Query keys for React Query
export const serverQueryKeys = {
  all: ['servers'] as const,
  lists: () => [...serverQueryKeys.all, 'list'] as const,
  list: (direction?: 'input' | 'output') => [...serverQueryKeys.lists(), direction] as const,
  details: () => [...serverQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...serverQueryKeys.details(), id] as const,
  types: () => [...serverQueryKeys.all, 'types'] as const,
  usage: (id: string) => [...serverQueryKeys.all, 'usage', id] as const,
};
