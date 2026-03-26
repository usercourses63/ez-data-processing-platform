// InvalidRecords API Client for InvalidRecordsService (port 5007)

interface ApiResponse<T> {
  isSuccess: boolean;
  data?: T;
  error?: {
    message: string;
    messageEnglish: string;
  };
}

interface InvalidRecordListParams {
  page?: number;
  pageSize?: number;
  dataSourceId?: string;
  errorType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  status?: string;
}

interface ValidationError {
  field: string;
  message: string;
  errorType: string;
  expectedValue?: string;
  actualValue?: string;
}

interface InvalidRecord {
  id: string;
  dataSourceId: string;
  dataSourceName: string;
  fileName: string;
  lineNumber?: number;
  createdAt: string;
  errors: ValidationError[];
  originalData: any;
  errorType: string;
  severity: string;
  isReviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  isIgnored: boolean;
  validatedWithSchemaVersion?: number;
  isRevalidated?: boolean;
}

interface InvalidRecordListResponse {
  data: InvalidRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Statistics {
  totalInvalidRecords: number;
  reviewedRecords: number;
  ignoredRecords: number;
  byDataSource: Record<string, number>;
  byErrorType: Record<string, number>;
  bySeverity: Record<string, number>;
}

interface BulkOperationResult {
  totalRequested: number;
  successful: number;
  failed: number;
  errors: Array<{
    recordId: string;
    error: string;
  }>;
}

interface BulkRevalidationResult {
  totalRecords: number;
  published: number;
  skipped: number;
  failed: number;
}

const API_BASE_URL = import.meta.env.VITE_INVALIDRECORDS_API_URL || '/api/v1/invalid-records';

export class InvalidRecordsApiClient {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          isSuccess: false,
          error: data.error || {
            message: `HTTP ${response.status}: ${response.statusText}`,
            messageEnglish: `HTTP ${response.status}: ${response.statusText}`
          }
        };
      }

      return data;
    } catch (error) {
      console.error('InvalidRecords API request failed:', error);
      return {
        isSuccess: false,
        error: {
          message: 'שגיאת רשת - בדוק חיבור לשרת',
          messageEnglish: 'Network error - check server connection'
        }
      };
    }
  }

  /**
   * Get invalid records with pagination and filtering
   */
  async getList(params: InvalidRecordListParams = {}): Promise<InvalidRecordListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params.dataSourceId) queryParams.append('dataSourceId', params.dataSourceId);
    if (params.errorType) queryParams.append('errorType', params.errorType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);

    const endpoint = queryParams.toString() ? `?${queryParams}` : '';
    const response = await this.request<any>(endpoint);
    
    if (response.isSuccess) {
      // Backend returns { isSuccess, data: [...], totalCount, page, pageSize, totalPages }
      // Cast response as any to access all properties
      const apiResponse = response as any;
      return {
        data: apiResponse.data || [],
        totalCount: apiResponse.totalCount || 0,
        page: apiResponse.page || 1,
        pageSize: apiResponse.pageSize || 10,
        totalPages: apiResponse.totalPages || 0
      };
    }
    
    throw new Error(response.error?.message || 'Failed to get invalid records');
  }

  /**
   * Get single invalid record by ID
   */
  async getById(id: string): Promise<InvalidRecord> {
    const response = await this.request<InvalidRecord>(`/${id}`);
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Invalid record not found');
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<Statistics> {
    const response = await this.request<Statistics>('/statistics');
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to get statistics');
  }

  /**
   * Update record status
   */
  async updateStatus(
    id: string,
    status: string,
    notes?: string,
    updatedBy: string = 'User'
  ): Promise<void> {
    const response = await this.request(`/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes, updatedBy }),
    });
    
    if (!response.isSuccess) {
      throw new Error(response.error?.message || 'Failed to update status');
    }
  }

  /**
   * Delete invalid record
   */
  async deleteRecord(id: string, deletedBy: string = 'User'): Promise<void> {
    const response = await this.request(`/${id}?deletedBy=${deletedBy}`, {
      method: 'DELETE',
    });
    
    if (!response.isSuccess) {
      throw new Error(response.error?.message || 'Failed to delete record');
    }
  }

  /**
   * Bulk delete records
   */
  async bulkDelete(recordIds: string[], requestedBy: string = 'User'): Promise<BulkOperationResult> {
    const response = await this.request<BulkOperationResult>('/bulk/delete', {
      method: 'POST',
      body: JSON.stringify({ recordIds, requestedBy }),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed bulk delete');
  }

  /**
   * Correct record data
   */
  async correctRecord(
    id: string,
    correctedData: any,
    correctedBy: string = 'User',
    autoReprocess: boolean = true
  ): Promise<any> {
    const response = await this.request(`/${id}/correct`, {
      method: 'PUT',
      body: JSON.stringify({ correctedData, correctedBy, autoReprocess }),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to correct record');
  }

  /**
   * Reprocess record
   */
  async reprocessRecord(id: string): Promise<any> {
    const response = await this.request(`/${id}/reprocess`, {
      method: 'POST',
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to reprocess record');
  }

  /**
   * Bulk reprocess records
   */
  async bulkReprocess(recordIds: string[], requestedBy: string = 'User'): Promise<BulkOperationResult> {
    const response = await this.request<BulkOperationResult>('/bulk/reprocess', {
      method: 'POST',
      body: JSON.stringify({ recordIds, requestedBy }),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed bulk reprocess');
  }

  /**
   * Bulk ignore records
   */
  async bulkIgnore(recordIds: string[], requestedBy: string = 'User'): Promise<BulkOperationResult> {
    const response = await this.request<BulkOperationResult>('/bulk/ignore', {
      method: 'POST',
      body: JSON.stringify({ recordIds, requestedBy }),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed bulk ignore');
  }

  /**
   * Export to CSV
   */
  async exportToCsv(filters: InvalidRecordListParams = {}): Promise<Blob> {
    const url = `${API_BASE_URL}/export`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters, format: 'CSV' }),
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export data');
    }
  }

  /**
   * Revalidate all invalid records (optionally filtered by dataSourceId)
   */
  async revalidateAll(dataSourceId?: string): Promise<ApiResponse<BulkRevalidationResult>> {
    return this.request<BulkRevalidationResult>('/revalidate-all', {
      method: 'POST',
      body: JSON.stringify({ DataSourceId: dataSourceId, TriggeredBy: 'ManualButton' }),
    });
  }

  /**
   * Get count of revalidatable records for confirmation popover
   */
  async getRevalidateCount(dataSourceId?: string): Promise<ApiResponse<{ count: number }>> {
    const params = dataSourceId ? `?dataSourceId=${dataSourceId}` : '';
    return this.request<{ count: number }>(`/revalidate-count${params}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ service: string; status: string; timestamp: string }> {
    const response = await this.request('/health');
    
    if (response.isSuccess && response.data) {
      return response.data as any;
    }
    
    throw new Error('Health check failed');
  }
}

// Export singleton instance
export const invalidRecordsApiClient = new InvalidRecordsApiClient();

// Export types
export type { InvalidRecord, ValidationError, Statistics, BulkOperationResult, BulkRevalidationResult, InvalidRecordListParams };
