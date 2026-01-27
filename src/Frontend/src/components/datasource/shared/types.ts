// TypeScript interfaces for DataSource forms and details

export interface DataSource {
  ID: string;
  Name: string;
  SupplierName: string;
  Category: string;
  Description?: string;
  IsActive: boolean;
  FilePath: string;
  FilePattern: string;
  AdditionalConfiguration?: {
    ConfigurationSettings?: string;
    ValidationRules?: string;
    Metadata?: string;
    RetentionDays?: number;
  };
  CreatedAt: string;
  UpdatedAt: string;
  LastProcessedAt?: string;
  TotalFilesProcessed: number;
  TotalErrorRecords: number;
  SchemaVersion: number;
  PollingRate: string;
  JsonSchema: any;
  // Schedule properties
  ScheduleFrequency?: string;
  scheduleFrequency?: string;
  ScheduleEnabled?: boolean;
  scheduleEnabled?: boolean;
  CronExpression?: string;
  cronExpression?: string;
  // Output configuration
  Output?: OutputConfiguration;
}

export interface ApiResponse<T> {
  CorrelationId: string;
  Data: T;
  Error: any;
  IsSuccess: boolean;
}

export interface ConnectionConfig {
  type: 'SFTP' | 'FTP' | 'HTTP' | 'Local' | 'Kafka';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  path?: string;
  url?: string;
  filePattern?: string;
  // Kafka-specific fields
  brokers?: string;
  topic?: string;
  consumerGroup?: string;
  securityProtocol?: string;
  offsetReset?: string;
}

export interface FileConfig {
  type: 'CSV' | 'Excel' | 'JSON' | 'XML';
  delimiter?: string;
  hasHeaders?: boolean;
  sheetName?: string;
  encoding?: string;
}

export interface ScheduleConfig {
  frequency: string;
  cronExpression?: string;
  enabled: boolean;
}

export interface ValidationRules {
  skipInvalidRecords: boolean;
  maxErrorsAllowed?: number;
}

export interface NotificationSettings {
  onSuccess: boolean;
  onFailure: boolean;
  recipients: string[];
}

export interface ParsedConfig {
  connectionConfig?: ConnectionConfig;
  fileConfig?: FileConfig;
  schedule?: ScheduleConfig;
  validationRules?: ValidationRules;
  notificationSettings?: NotificationSettings;
  outputConfig?: OutputConfiguration;
}

// Output Configuration Types (Task-26)
export interface OutputConfiguration {
  defaultOutputFormat?: 'original' | 'json' | 'csv' | 'xml';
  includeInvalidRecords?: boolean;
  destinations?: OutputDestination[];
}

export interface OutputDestination {
  id: string;
  name: string;
  description?: string;
  type: 'kafka' | 'folder' | 'sftp' | 'http' | 's3' | 'nfs';
  enabled: boolean;
  outputFormat?: 'original' | 'json' | 'csv' | 'xml' | null;
  includeInvalidRecords?: boolean | null;
  // v0.2.0: Server-based configuration
  outputServerId?: string;  // Reference to AdminServer for server-based config
  // Legacy manual configuration (deprecated in v0.2.0, will be removed in v0.3.0)
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
  // Authentication
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
