// Entity type definitions

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  isDeleted?: boolean;
  version?: number;
  // Legacy format support (PascalCase)
  ID?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  IsDeleted?: boolean;
  Version?: number;
}

export interface DataSource extends BaseEntity {
  name: string;
  supplierName: string;
  category: string;
  description?: string;
  isActive: boolean;
  filePath?: string;
  filePattern?: string;
  connectionString?: string;
  configurationSettings?: string;
  validationRules?: string;
  metadata?: string;
  fileFormat?: string;
  retentionDays?: number;
  invalidRecordsTtlDays?: number;
  lastProcessedAt?: string;
  totalFilesProcessed: number;
  totalErrorRecords: number;
  jsonSchema?: JSONSchema;
  schemaVersion?: number;
  pollingRate?: string;
  // Schedule properties
  scheduleFrequency?: string;
  scheduleEnabled?: boolean;
  cronExpression?: string;
  // Output configuration
  output?: OutputConfiguration;
  // Legacy format support (PascalCase)
  Name?: string;
  SupplierName?: string;
  Category?: string;
  Description?: string;
  IsActive?: boolean;
  FilePath?: string;
  FilePattern?: string;
  ConnectionString?: string;
  ConfigurationSettings?: string;
  ValidationRules?: string;
  Metadata?: string;
  FileFormat?: string;
  RetentionDays?: number;
  LastProcessedAt?: string;
  TotalFilesProcessed?: number;
  TotalErrorRecords?: number;
  JsonSchema?: JSONSchema;
  SchemaVersion?: number;
  PollingRate?: string;
  ScheduleFrequency?: string;
  ScheduleEnabled?: boolean;
  CronExpression?: string;
  Output?: OutputConfiguration;
}

export interface MetricConfiguration extends BaseEntity {
  name: string;
  displayName: string;
  description: string;
  category: string;
  scope: 'global' | 'datasource-specific';
  dataSourceId: string | null;
  dataSourceName?: string;
  prometheusType?: 'counter' | 'gauge' | 'histogram' | 'summary';
  formula: string;
  fieldPath?: string;
  labels?: string[];
  retention?: string;
  status: MetricStatus;
  lastValue?: number;
  lastCalculated?: string;
  createdBy: string;
  updatedBy: string;
}

export enum MetricStatus {
  Draft = 0,
  Active = 1,
  Inactive = 2,
  Error = 3
}

export interface InvalidRecord {
  id: string;
  dataSourceId: string;
  dataSourceName: string;
  fileName: string;
  recordContent: string;
  errorMessage: string;
  errorDetails?: string;
  validationErrors: ValidationError[];
  receivedAt: string;
  status: InvalidRecordStatus;
  retryCount: number;
  lastRetryAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

export enum InvalidRecordStatus {
  Pending = 0,
  InReview = 1,
  Corrected = 2,
  Discarded = 3,
  Reprocessed = 4
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  constraint?: string;
}

export interface AlertRule {
  id?: string;
  name: string;
  description?: string;
  severity: 'critical' | 'warning' | 'info';
  expression: string;
  for?: string;
  isEnabled: boolean;
  notificationRecipients?: string[];
  metricId: string;
  metricName?: string;
  metricDisplayName?: string;
  labels?: Record<string, string>;
}

// JSON Schema types
export interface JSONSchema {
  $schema?: string;
  title?: string;
  description?: string;
  type?: string | string[];
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | JSONSchemaProperty;
  items?: JSONSchemaProperty;
  enum?: any[];
  const?: any;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  definitions?: Record<string, JSONSchemaProperty>;
  $ref?: string;
  allOf?: JSONSchemaProperty[];
  anyOf?: JSONSchemaProperty[];
  oneOf?: JSONSchemaProperty[];
  not?: JSONSchemaProperty;
}

export interface JSONSchemaProperty {
  type?: string | string[];
  description?: string;
  title?: string;
  default?: any;
  enum?: any[];
  const?: any;
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  properties?: Record<string, JSONSchemaProperty>;
  items?: JSONSchemaProperty;
  required?: string[];
  additionalProperties?: boolean | JSONSchemaProperty;
  $ref?: string;
  allOf?: JSONSchemaProperty[];
  anyOf?: JSONSchemaProperty[];
  oneOf?: JSONSchemaProperty[];
  not?: JSONSchemaProperty;
}

// Output Configuration
export interface OutputConfiguration {
  defaultOutputFormat?: 'original' | 'json' | 'csv' | 'xml';
  includeInvalidRecords?: boolean;
  destinations?: OutputDestination[];
}

export interface OutputDestination {
  id: string;
  name: string;
  description?: string;
  type: 'kafka' | 'folder' | 'sftp' | 'http';
  enabled: boolean;
  outputFormat?: 'original' | 'json' | 'csv' | 'xml' | null;
  includeInvalidRecords?: boolean | null;
  kafkaConfig?: KafkaOutputConfig;
  folderConfig?: FolderOutputConfig;
  sftpConfig?: SftpOutputConfig;
  httpConfig?: HttpOutputConfig;
}

export interface KafkaOutputConfig {
  brokerServer?: string;
  topic: string;
  messageKey?: string;
  headers?: Record<string, string>;
  securityProtocol?: 'PLAINTEXT' | 'SASL_SSL' | 'SASL_PLAINTEXT';
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512';
  username?: string;
  password?: string;
}

export interface FolderOutputConfig {
  path: string;
  fileNamePattern?: string;
  createSubfolders?: boolean;
  subfolderPattern?: string;
}

export interface SftpOutputConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  path: string;
  fileNamePattern?: string;
}

export interface HttpOutputConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  authType?: 'none' | 'basic' | 'bearer';
  authToken?: string;
}
