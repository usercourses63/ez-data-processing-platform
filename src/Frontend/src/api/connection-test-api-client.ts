// connection-test-api-client.ts - API client for connection testing
// Date: December 2, 2025

import axios from 'axios';

const API_BASE_URL = '/api/v1/test-connection';

// Request Interfaces

export interface KafkaTestRequest {
  brokerServer: string;
  topic: string;
  username?: string;
  password?: string;
  timeoutSeconds?: number;
}

export interface FolderTestRequest {
  path: string;
  checkWritePermissions?: boolean;
  checkDiskSpace?: boolean;
}

export interface SftpTestRequest {
  host: string;
  port: number;
  username: string;
  password?: string;
  sshKey?: string;
  remotePath: string;
  timeoutSeconds?: number;
}

// Response Interface

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details: Record<string, any>;
  errorDetails?: string;
  durationMs: number;
}

// API Methods

export const testKafkaConnection = async (
  request: KafkaTestRequest
): Promise<ConnectionTestResult> => {
  try {
    const response = await axios.post<ConnectionTestResult>(
      `${API_BASE_URL}/kafka`,
      {
        ...request,
        timeoutSeconds: request.timeoutSeconds || 30
      },
      {
        timeout: (request.timeoutSeconds || 30) * 1000
      }
    );
    return response.data;
  } catch (error: any) {
    // Handle axios errors
    if (error.response?.data) {
      return error.response.data;
    }

    // Handle timeout or network errors
    return {
      success: false,
      message: 'Connection test failed',
      errorDetails: error.message || 'Network error or timeout',
      details: {},
      durationMs: 0
    };
  }
};

export const testFolderConnection = async (
  request: FolderTestRequest
): Promise<ConnectionTestResult> => {
  try {
    const response = await axios.post<ConnectionTestResult>(
      `${API_BASE_URL}/folder`,
      {
        ...request,
        checkWritePermissions: request.checkWritePermissions ?? true,
        checkDiskSpace: request.checkDiskSpace ?? true
      },
      {
        timeout: 30000
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      return error.response.data;
    }

    return {
      success: false,
      message: 'Folder validation failed',
      errorDetails: error.message || 'Network error or timeout',
      details: {},
      durationMs: 0
    };
  }
};

export const testSftpConnection = async (
  request: SftpTestRequest
): Promise<ConnectionTestResult> => {
  try {
    const response = await axios.post<ConnectionTestResult>(
      `${API_BASE_URL}/sftp`,
      {
        ...request,
        timeoutSeconds: request.timeoutSeconds || 30
      },
      {
        timeout: (request.timeoutSeconds || 30) * 1000
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response?.data) {
      return error.response.data;
    }

    return {
      success: false,
      message: 'SFTP connection test failed',
      errorDetails: error.message || 'Network error or timeout',
      details: {},
      durationMs: 0
    };
  }
};
