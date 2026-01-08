// Metrics Configuration API Client
// Connects to MetricsConfigurationService on port 5002

const BASE_URL = '/api/v1/metrics';

export interface MetricConfiguration {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  scope: 'global' | 'datasource-specific';
  dataSourceId: string | null;
  dataSourceName?: string;
  prometheusType?: string; // counter, gauge, histogram, summary
  formula: string;
  fieldPath?: string;
  labels?: string[];
  retention?: string;
  status: number; // 0=Draft, 1=Active, 2=Inactive, 3=Error
  lastValue?: number;
  lastCalculated?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CreateMetricRequest {
  name: string;
  displayName: string;
  description: string;
  category: string;
  scope: string;
  dataSourceId?: string | null;
  dataSourceName?: string | null;
  prometheusType?: string;
  formula: string;
  fieldPath?: string | null;
  labels?: string[];
  retention?: string | null;
  status: number;
  createdBy: string;
}

export interface UpdateMetricRequest {
  displayName: string;
  description: string;
  category: string;
  scope: string;
  dataSourceId?: string | null;
  dataSourceName?: string | null;
  prometheusType?: string;
  formula: string;
  formulaType?: number; // FormulaType enum: 0=Simple, 1=PromQL, 2=Recording
  fieldPath?: string | null;
  labelNames?: string | null; // comma-separated string
  labelsExpression?: string | null;
  labels?: string[] | null; // string[] for backward compatibility
  alertRules?: any[]; // AlertRule[]
  retention?: string | null; // string like "30d"
  status: number; // int: 0=Draft, 1=Active, 2=Inactive, 3=Error
  updatedBy: string;
}

export interface DuplicateMetricRequest {
  name: string;
  displayName: string;
  description: string;
  createdBy: string;
}

export interface ApiResponse<T> {
  isSuccess: boolean;
  data?: T;
  message?: string;
  error?: {
    message: string;
  };
}

// Global Alert interfaces (for business/system metrics)
export interface GlobalAlertConfiguration {
  id: string;
  metricType: 'business' | 'system';
  metricName: string;
  alertName: string;
  description?: string;
  expression: string;
  for?: string;
  severity: 'critical' | 'warning' | 'info';
  isEnabled: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  notificationRecipients?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CreateGlobalAlertRequest {
  metricType: 'business' | 'system';
  metricName: string;
  alertName: string;
  description?: string;
  expression: string;
  for?: string;
  severity: string;
  isEnabled?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  notificationRecipients?: string[];
  createdBy?: string;
}

export interface UpdateGlobalAlertRequest {
  alertName?: string;
  description?: string;
  expression?: string;
  for?: string;
  severity?: string;
  isEnabled?: boolean;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  notificationRecipients?: string[];
  updatedBy?: string;
}

class MetricsApiClient {
  async getAll(): Promise<MetricConfiguration[]> {
    const response = await fetch(BASE_URL);
    const result: ApiResponse<MetricConfiguration[]> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch metrics');
    }
    
    return result.data || [];
  }

  async getById(id: string): Promise<MetricConfiguration> {
    const response = await fetch(`${BASE_URL}/${id}`);
    const result: ApiResponse<MetricConfiguration> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch metric');
    }
    
    return result.data!;
  }

  async create(request: CreateMetricRequest): Promise<MetricConfiguration> {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(request),
    });
    
    const result: ApiResponse<MetricConfiguration> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to create metric');
    }
    
    return result.data!;
  }

  async update(id: string, request: UpdateMetricRequest): Promise<MetricConfiguration> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(request),
    });
    
    const result: ApiResponse<MetricConfiguration> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to update metric');
    }
    
    return result.data!;
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
    });
    
    const result: ApiResponse<void> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to delete metric');
    }
  }

  async duplicate(id: string, request: DuplicateMetricRequest): Promise<MetricConfiguration> {
    const response = await fetch(`${BASE_URL}/${id}/duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(request),
    });
    
    const result: ApiResponse<MetricConfiguration> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to duplicate metric');
    }
    
    return result.data!;
  }

  async getByDataSource(dataSourceId: string): Promise<MetricConfiguration[]> {
    const response = await fetch(`${BASE_URL}/datasource/${dataSourceId}`);
    const result: ApiResponse<MetricConfiguration[]> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch metrics for data source');
    }
    
    return result.data || [];
  }

  async getGlobal(): Promise<MetricConfiguration[]> {
    const response = await fetch(`${BASE_URL}/global`);
    const result: ApiResponse<MetricConfiguration[]> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch global metrics');
    }
    
    return result.data || [];
  }

  // NEW: Prometheus Data Query Methods

  async getCurrentValue(metricId: string): Promise<any> {
    const response = await fetch(`${BASE_URL}/${metricId}/current`);
    const result: ApiResponse<any> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch current value');
    }
    
    return result.data;
  }

  async getTimeSeriesData(
    metricId: string, 
    start?: Date, 
    end?: Date, 
    step: string = '1m'
  ): Promise<any> {
    const params = new URLSearchParams();
    if (start) params.append('start', start.toISOString());
    if (end) params.append('end', end.toISOString());
    params.append('step', step);

    const response = await fetch(`${BASE_URL}/${metricId}/data?${params.toString()}`);
    const result: ApiResponse<any> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch time-series data');
    }
    
    return result.data;
  }

  async executePromQLQuery(request: {
    query: string;
    queryType?: 'instant' | 'range';
    instance?: 'system' | 'business';
    start?: Date;
    end?: Date;
    step?: string;
  }): Promise<any> {
    const response = await fetch(`${BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        ...request,
        queryType: request.queryType || 'instant',
        instance: request.instance || 'business',
        start: request.start?.toISOString(),
        end: request.end?.toISOString(),
        step: request.step || '1m'
      }),
    });
    
    const result: ApiResponse<any> = await response.json();
    
    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to execute PromQL query');
    }
    
    return result.data;
  }

  async getAvailableMetrics(instance: 'system' | 'business' = 'business'): Promise<string[]> {
    const response = await fetch(`${BASE_URL}/available?instance=${instance}`);
    const result: ApiResponse<{ metricNames: string[]; count: number }> = await response.json();

    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch available metrics');
    }

    return result.data?.metricNames || [];
  }

  // Global Alert methods (for business/system metrics)
  private readonly GLOBAL_ALERTS_URL = '/api/v1/global-alerts';

  async getGlobalAlerts(metricType?: 'business' | 'system'): Promise<GlobalAlertConfiguration[]> {
    const url = metricType
      ? `${this.GLOBAL_ALERTS_URL}?metricType=${metricType}`
      : this.GLOBAL_ALERTS_URL;
    const response = await fetch(url);
    const result: ApiResponse<GlobalAlertConfiguration[]> = await response.json();

    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch global alerts');
    }

    return result.data || [];
  }

  async getGlobalAlertById(id: string): Promise<GlobalAlertConfiguration> {
    const response = await fetch(`${this.GLOBAL_ALERTS_URL}/${id}`);
    const result: ApiResponse<GlobalAlertConfiguration> = await response.json();

    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch global alert');
    }

    return result.data!;
  }

  async createGlobalAlert(request: CreateGlobalAlertRequest): Promise<GlobalAlertConfiguration> {
    const response = await fetch(this.GLOBAL_ALERTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(request),
    });

    const result: ApiResponse<GlobalAlertConfiguration> = await response.json();

    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to create global alert');
    }

    return result.data!;
  }

  async updateGlobalAlert(id: string, request: UpdateGlobalAlertRequest): Promise<GlobalAlertConfiguration> {
    const response = await fetch(`${this.GLOBAL_ALERTS_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(request),
    });

    const result: ApiResponse<GlobalAlertConfiguration> = await response.json();

    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to update global alert');
    }

    return result.data!;
  }

  async deleteGlobalAlert(id: string): Promise<void> {
    const response = await fetch(`${this.GLOBAL_ALERTS_URL}/${id}`, {
      method: 'DELETE',
    });

    const result: ApiResponse<void> = await response.json();

    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to delete global alert');
    }
  }

  async getGlobalAlertsByMetricName(metricName: string): Promise<GlobalAlertConfiguration[]> {
    const response = await fetch(`${this.GLOBAL_ALERTS_URL}/metric/${encodeURIComponent(metricName)}`);
    const result: ApiResponse<GlobalAlertConfiguration[]> = await response.json();

    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch global alerts by metric name');
    }

    return result.data || [];
  }

  async getEnabledGlobalAlerts(): Promise<GlobalAlertConfiguration[]> {
    const response = await fetch(`${this.GLOBAL_ALERTS_URL}/enabled`);
    const result: ApiResponse<GlobalAlertConfiguration[]> = await response.json();

    if (!result.isSuccess) {
      throw new Error(result.error?.message || 'Failed to fetch enabled global alerts');
    }

    return result.data || [];
  }
}

export const metricsApi = new MetricsApiClient();
export default metricsApi;
