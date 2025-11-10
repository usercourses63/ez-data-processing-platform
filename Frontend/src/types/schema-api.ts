// Schema API Type Definitions

export interface Schema {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  jsonSchema: any;
  version: string;
  status: SchemaStatus;
  dataSourceId?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

export enum SchemaStatus {
  Draft = 'Draft',
  Active = 'Active',
  Inactive = 'Inactive',
  Archived = 'Archived'
}

export interface SchemaListParams {
  page?: number;
  size?: number;
  search?: string;
  status?: SchemaStatus;
  dataSourceId?: string;
}

export interface SchemaListResponse {
  isSuccess: boolean;
  data?: {
    items: Schema[];
    totalCount: number;
    page: number;
    size: number;
    totalPages: number;
  };
  error?: ApiError;
}

export interface CreateSchemaRequest {
  name: string;
  displayName: string;
  description?: string;
  jsonSchema: any;
  dataSourceId?: string;
  tags?: string[];
  createdBy: string;
}

export interface UpdateSchemaRequest {
  displayName?: string;
  description?: string;
  jsonSchema?: any;
  dataSourceId?: string;
  tags?: string[];
  status?: SchemaStatus;
  updatedBy: string;
}

export interface ApiError {
  message: string;
  messageEnglish?: string;
  code?: string;
}

export interface ApiResponse<T> {
  isSuccess: boolean;
  data?: T;
  error?: ApiError;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
}

export interface DataValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
  validatedData?: any;
}

export interface SchemaTemplate {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  complexity: 'Simple' | 'Medium' | 'Complex';
  jsonSchema: any;
  tags: string[];
}

export interface SchemaUsageStatistics {
  schemaId: string;
  usageCount: number;
  dataSourceCount: number;
  lastUsed?: string;
}

export interface DuplicateSchemaRequest {
  newName: string;
  newDisplayName: string;
  createdBy: string;
}

export interface ValidateJsonSchemaRequest {
  jsonSchema: any;
}

export interface TestRegexRequest {
  pattern: string;
  testStrings: string[];
}

export interface RegexTestResult {
  pattern: string;
  results: {
    testString: string;
    isMatch: boolean;
    groups?: string[];
  }[];
  successRate: number;
}
