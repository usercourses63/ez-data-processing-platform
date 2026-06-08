// Helper functions for DataSource forms
import cronstrue from 'cronstrue/i18n';
import type { ClonePayload, OutputDestination, S3OutputConfig } from './types';

/**
 * Humanizes a cron expression into Hebrew description using cronstrue library
 */
export const humanizeCron = (cronExpr: string): string => {
  if (!cronExpr) return '';
  
  try {
    const description = cronstrue.toString(cronExpr.trim(), { 
      locale: 'he',
      use24HourTimeFormat: true,
      throwExceptionOnParseError: false
    });
    return `⏰ ${description}`;
  } catch (error) {
    return '⏰ ביטוי מותאם';
  }
};

/**
 * Maps a schedule frequency to a cron expression
 */
export const frequencyToCron = (frequency: string): string | undefined => {
  const mapping: Record<string, string> = {
    'Every5Minutes': '*/5 * * * *',
    'Every10Minutes': '*/10 * * * *',
    'Every15Minutes': '*/15 * * * *',
    'Every30Minutes': '*/30 * * * *',
    'Hourly': '0 * * * *',
    'Every2Hours': '0 */2 * * *',
    'Every3Hours': '0 */3 * * *',
    'Every6Hours': '0 */6 * * *',
    'Daily': '0 0 * * *',
    'Daily6AM': '0 6 * * *',
    'Daily8AM': '0 8 * * *',
    'DailyNoon': '0 12 * * *',
    'Daily6PM': '0 18 * * *',
    'Weekdays8AM': '0 8 * * 1-5',
    'Weekdays6PM': '0 18 * * 1-5',
    'Weekly': '0 0 * * 0',
    'Monthly': '0 0 1 * *'
  };
  return mapping[frequency];
};

/**
 * Builds a connection string from form values
 */
export const buildConnectionString = (values: any): string => {
  switch (values.connectionType) {
    case 'SFTP':
    case 'FTP':
      return `${values.connectionType.toLowerCase()}://${values.connectionHost}:${values.connectionPort}${values.filePath}`;
    case 'HTTP':
      return values.connectionUrl;
    case 'Local':
      return values.filePath;
    case 'Kafka':
      return `kafka://${values.kafkaBrokers}/${values.kafkaTopic}`;
    default:
      return '';
  }
};

/**
 * Extracts file type from FilePattern (e.g., "*.csv" -> "CSV")
 */
export const extractFileTypeFromPattern = (filePattern?: string): string => {
  if (!filePattern) return 'CSV';
  
  const match = filePattern.match(/\*\.([a-zA-Z]+)/);
  if (match) {
    const extension = match[1].toLowerCase();
    switch (extension) {
      case 'csv': return 'CSV';
      case 'xls':
      case 'xlsx': return 'Excel';
      case 'json': return 'JSON';
      case 'xml': return 'XML';
      default: return 'CSV';
    }
  }
  return 'CSV';
};

/**
 * Gets display label for delimiter character
 */
export const getDelimiterLabel = (delimiter?: string): string => {
  if (!delimiter) return 'פסיק (,)';

  switch (delimiter) {
    case ',': return 'פסיק (,)';
    case ';': return 'נקודה-פסיק (;)';
    case '\t': return 'Tab';
    case '|': return 'Pipe (|)';
    default: return delimiter;
  }
};

/**
 * Transforms a full DataSource API response into a ClonePayload
 * for passing via location.state to the create form.
 *
 * Per D-04: Carries over all config (connection, file, schema, validation, notifications, output, archive).
 * Per D-05: Resets name (prefix), schedule (disabled), output destination IDs (new UUIDs), stats.
 */
export const prepareCloneData = (
  dataSource: any,
  parsedConfig: any,
  language: string
): ClonePayload => {
  const namePrefix = language === 'he' ? 'העתק של ' : 'Copy of ';
  const uniqueSuffix = Math.random().toString(36).substring(2, 7);
  const generateUUID = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });

  // Clone output destinations with new UUIDs (per D-04)
  // Handle both camelCase and PascalCase (ConfigurationSettings uses PascalCase)
  const clonedDestinations: OutputDestination[] = (
    parsedConfig?.outputConfig?.destinations ||
    parsedConfig?.outputConfig?.Destinations?.map((d: any) => ({
      id: d.Id || d.id,
      name: d.Name || d.name,
      description: d.Description || d.description,
      type: d.Type || d.type,
      enabled: d.Enabled ?? d.enabled ?? true,
      outputFormat: d.OutputFormat || d.outputFormat,
      includeInvalidRecords: d.IncludeInvalidRecords ?? d.includeInvalidRecords,
      outputServerId: d.OutputServerId || d.outputServerId,
      nasDeviceId: d.NasDeviceId || d.nasDeviceId,
      kafkaConfig: d.KafkaConfig || d.kafkaConfig,
      folderConfig: d.FolderConfig || d.folderConfig,
      sftpConfig: d.SftpConfig || d.sftpConfig,
      httpConfig: d.HttpConfig || d.httpConfig,
    })) ||
    dataSource?.Output?.Destinations?.map((d: any) => ({
      id: d.Id || d.id,
      name: d.Name || d.name,
      description: d.Description || d.description,
      type: d.Type || d.type,
      enabled: d.Enabled ?? d.enabled ?? true,
      outputFormat: d.OutputFormat || d.outputFormat,
      includeInvalidRecords: d.IncludeInvalidRecords ?? d.includeInvalidRecords,
      outputServerId: d.OutputServerId || d.outputServerId,
      nasDeviceId: d.NasDeviceId || d.nasDeviceId,
      kafkaConfig: d.KafkaConfig || d.kafkaConfig,
      folderConfig: d.FolderConfig || d.folderConfig,
      sftpConfig: d.SftpConfig || d.sftpConfig,
      httpConfig: d.HttpConfig || d.httpConfig,
    })) ||
    []
  ).map((dest: OutputDestination) => ({
    ...dest,
    id: generateUUID(),
  }));

  return {
    name: `${namePrefix}${dataSource.Name} (${uniqueSuffix})`,
    supplierName: dataSource.SupplierName || '',
    category: dataSource.Category || '',
    description: dataSource.Description || dataSource.AdditionalConfiguration?.Metadata || '',
    isActive: true,
    filePattern: dataSource.FilePattern || '*.*',
    connectionConfig: parsedConfig?.connectionConfig || undefined,
    fileConfig: parsedConfig?.fileConfig || undefined,
    validationRules: parsedConfig?.validationRules || undefined,
    notificationSettings: parsedConfig?.notificationSettings || undefined,
    outputConfig: {
      defaultOutputFormat: parsedConfig?.outputConfig?.defaultOutputFormat || parsedConfig?.outputConfig?.DefaultOutputFormat || dataSource?.Output?.DefaultOutputFormat || 'original',
      includeInvalidRecords: parsedConfig?.outputConfig?.includeInvalidRecords ?? parsedConfig?.outputConfig?.IncludeInvalidRecords ?? dataSource?.Output?.IncludeInvalidRecords ?? false,
      destinations: clonedDestinations,
    },
    jsonSchema: dataSource.JsonSchema || undefined,
    retentionDays: dataSource.AdditionalConfiguration?.RetentionDays || dataSource.RetentionDays || 30,
    archiveSettings: dataSource.ArchiveSettings || undefined,
    schedule: parsedConfig?.schedule ? {
      frequency: parsedConfig.schedule.frequency,
      cronExpression: parsedConfig.schedule.cronExpression,
    } : undefined,
  };
};

/**
 * Merges submitted form values with the existing stored connectionConfig when updating a datasource.
 *
 * Bug #2 fix (TASK B): the edit form lazy-loads the Connection tab, so if the user changes the
 * schema on another tab and saves before that tab mounts/hydrates, `values.inputServerId` is
 * missing OR an empty string. The previous merge used `??`, which does not catch `''`, so the
 * stored server reference was overwritten with an empty value and the connection appeared wiped.
 *
 * The server/device references therefore fall back with `||` (catches both `undefined` and `''`)
 * to the existing stored config and finally to the authoritative `FileServerId`/`NasDeviceId`
 * columns on the loaded dataSource — so a partial submit can never drop the connection.
 */
export const mergeConnectionConfig = (
  values: any,
  existingConnectionConfig: any,
  dataSource?: any
): Record<string, any> => {
  const existing = existingConnectionConfig || {};
  return {
    ...existing,
    type: values.connectionType || existing.type,
    host: values.connectionHost ?? existing.host,
    port: values.connectionPort ?? existing.port,
    username: values.connectionUsername ?? existing.username,
    password: values.connectionPassword ?? existing.password,
    path: values.filePath ?? existing.path,
    url: values.connectionUrl ?? existing.url,
    filePattern: values.filePattern ?? existing.filePattern ?? '*.*',
    // Kafka-specific fields
    brokers: values.kafkaBrokers ?? existing.brokers,
    topic: values.kafkaTopic ?? existing.topic,
    consumerGroup: values.kafkaConsumerGroup ?? existing.consumerGroup,
    securityProtocol: values.kafkaSecurityProtocol ?? existing.securityProtocol,
    offsetReset: values.kafkaOffsetReset ?? existing.offsetReset,
    // Server reference (v0.2.0) — never drop it on a partial submit (lazy ConnectionTab).
    // `||` so an empty string also falls through to the stored value / authoritative column.
    inputServerId: values.inputServerId || existing.inputServerId || dataSource?.FileServerId,
    // NAS-specific fields
    nasDeviceId: values.nasDeviceId || existing.nasDeviceId || dataSource?.NasDeviceId,
    nasSubPath: values.nasSubPath ?? existing.nasSubPath,
  };
};

/**
 * Builds the S3 output config from the typed "Bucket / Prefix" path field.
 *
 * Splits the path on the FIRST '/' into:
 *   - bucket:    the segment before the slash (e.g. "ez-phase34-output")
 *   - keyPrefix: the remainder, or undefined when there is no prefix
 *
 * Credentials/endpoint/region are intentionally left undefined — the backend bridges
 * them (decrypted) from the selected output AdminServer (outputServerId). usePathStyle
 * defaults to true (MinIO requires path-style addressing).
 */
export const buildS3OutputConfig = (path: string | undefined | null): S3OutputConfig => {
  const trimmed = (path || '').trim().replace(/^\/+/, '');
  const slashIdx = trimmed.indexOf('/');
  const bucket = slashIdx >= 0 ? trimmed.slice(0, slashIdx) : trimmed;
  const rest = slashIdx >= 0 ? trimmed.slice(slashIdx + 1) : '';
  const keyPrefix = rest.length > 0 ? rest : undefined;
  return {
    bucket,
    keyPrefix,
    usePathStyle: true,
  };
};

/**
 * Reconstructs the editable "Bucket / Prefix" path string from a persisted s3Config
 * so an edit round-trips (bucket + '/' + keyPrefix).
 */
export const s3ConfigToPath = (s3Config?: S3OutputConfig): string => {
  if (!s3Config) return '';
  const bucket = s3Config.bucket || '';
  const prefix = s3Config.keyPrefix;
  return prefix ? `${bucket}/${prefix}` : bucket;
};
