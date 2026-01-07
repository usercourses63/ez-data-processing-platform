// API-related type definitions

export interface ApiResponse<T> {
  isSuccess: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
  correlationId?: string;
  // Legacy format support
  Data?: T;
  IsSuccess?: boolean;
  CorrelationId?: string;
  Error?: any;
}

export interface ApiError {
  message: string;
  messageEnglish?: string;
  code?: string;
  details?: Record<string, any>;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  // Legacy format support
  Items?: T[];
  Page?: number;
  PageSize?: number;
  TotalItems?: number;
  TotalPages?: number;
  HasNextPage?: boolean;
  HasPreviousPage?: boolean;
}

export interface QueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  service: string;
  version?: string;
  dependencies?: Record<string, string>;
}
