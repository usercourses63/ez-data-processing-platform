import {
  SchemaListParams,
  SchemaListResponse,
  CreateSchemaRequest,
  UpdateSchemaRequest,
  DuplicateSchemaRequest,
  ValidateJsonSchemaRequest,
  TestRegexRequest,
  Schema,
  ValidationResult,
  DataValidationResult,
  RegexTestResult,
  SchemaTemplate,
  SchemaUsageStatistics,
  ApiResponse
} from '../types/schema-api';

const API_BASE_URL = import.meta.env.VITE_SCHEMA_API_URL || 'http://localhost:5001/api/v1/schema';

export class SchemaApiClient {
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
      console.error('API request failed:', error);
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
   * Get schemas with pagination and filtering
   */
  async getSchemas(params: SchemaListParams = {}): Promise<SchemaListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.size) queryParams.append('size', params.size.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.dataSourceId) queryParams.append('dataSourceId', params.dataSourceId);

    const endpoint = queryParams.toString() ? `?${queryParams}` : '';
    const response = await this.request<any>(endpoint);
    
    if (response.isSuccess && response.data) {
      return response as SchemaListResponse; // Cast to proper type
    }
    
    throw new Error(response.error?.message || 'Failed to get schemas');
  }

  /**
   * Get schema by ID
   */
  async getSchema(id: string): Promise<Schema> {
    const response = await this.request<Schema>(`/${id}`);
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Schema not found');
  }

  /**
   * Create new schema
   */
  async createSchema(request: CreateSchemaRequest): Promise<Schema> {
    const response = await this.request<Schema>('', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to create schema');
  }

  /**
   * Update existing schema
   */
  async updateSchema(id: string, request: UpdateSchemaRequest): Promise<Schema> {
    const response = await this.request<Schema>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to update schema');
  }

  /**
   * Delete schema
   */
  async deleteSchema(id: string, deletedBy: string = 'User'): Promise<void> {
    const response = await this.request(`/${id}?deletedBy=${deletedBy}`, {
      method: 'DELETE',
    });
    
    if (!response.isSuccess) {
      throw new Error(response.error?.message || 'Failed to delete schema');
    }
  }

  /**
   * Validate sample data against schema
   */
  async validateSampleData(id: string, data: object): Promise<DataValidationResult> {
    const response = await this.request<DataValidationResult>(`/${id}/validate`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Validation failed');
  }

  /**
   * Publish draft schema to active
   */
  async publishSchema(id: string): Promise<Schema> {
    const response = await this.request<Schema>(`/${id}/publish`, {
      method: 'POST',
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to publish schema');
  }

  /**
   * Duplicate existing schema
   */
  async duplicateSchema(id: string, request: DuplicateSchemaRequest): Promise<Schema> {
    const response = await this.request<Schema>(`/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to duplicate schema');
  }

  /**
   * Get usage statistics for schema
   */
  async getUsageStatistics(id: string): Promise<SchemaUsageStatistics> {
    const response = await this.request<SchemaUsageStatistics>(`/${id}/usage`);
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to get usage statistics');
  }

  /**
   * Validate JSON Schema syntax
   */
  async validateJsonSchema(request: ValidateJsonSchemaRequest): Promise<ValidationResult> {
    const response = await this.request<ValidationResult>('/validate-json', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'JSON Schema validation failed');
  }

  /**
   * Get available schema templates
   */
  async getTemplates(): Promise<SchemaTemplate[]> {
    const response = await this.request<SchemaTemplate[]>('/templates');
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to get templates');
  }

  /**
   * Test regex pattern against strings
   */
  async testRegex(request: TestRegexRequest): Promise<RegexTestResult> {
    const response = await this.request<RegexTestResult>('/regex/test', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    
    if (response.isSuccess && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Regex test failed');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    const response = await this.request('/health');
    
    if (response.isSuccess && response.data) {
      return response.data as any;
    }
    
    throw new Error('Health check failed');
  }
}

// Export singleton instance
export const schemaApiClient = new SchemaApiClient();
