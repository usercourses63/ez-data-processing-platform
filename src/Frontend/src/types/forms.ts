// Form-related type definitions

export type FormMode = 'create' | 'edit' | 'view';

export interface FormState {
  mode: FormMode;
  loading: boolean;
  error: string | null;
  isDirty: boolean;
}

export type ValidationStatus = 'validating' | 'success' | 'error' | 'warning';

export interface ValidationRule {
  required?: boolean;
  message?: string;
  pattern?: RegExp;
  min?: number;
  max?: number;
  len?: number;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'url';
  validator?: (rule: any, value: any) => Promise<void>;
  whitespace?: boolean;
  transform?: (value: any) => any;
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
