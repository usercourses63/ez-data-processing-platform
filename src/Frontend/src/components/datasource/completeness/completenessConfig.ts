/**
 * Completeness Configuration
 *
 * Static field configuration for all 9 datasource tabs. Defines which fields
 * belong to which tab, their required status, and conditional requirements.
 *
 * Field names MUST match the actual Form.Item `name` attributes in each tab component.
 */

import type { TabFieldConfig } from './types';

// ============================================================================
// Schema-FileType Alignment Check (D-22/D-23/D-24/D-25/D-26)
// ============================================================================

/**
 * Checks whether a JSON schema structure is compatible with the selected file type.
 *
 * - CSV/Excel: Only flat schemas (no nested objects or arrays)
 * - XML/JSON: Any valid schema structure
 * - Unknown/empty file type: Skip alignment check
 *
 * Returns { isAligned, reason?, info? } where reason/info are i18n keys.
 */
export function checkSchemaFileTypeAlignment(
  jsonSchema: any,
  fileType: string | undefined,
  hasHeaders?: boolean
): { isAligned: boolean; reason?: string; info?: string } {
  // If no file type selected, skip alignment check
  if (!fileType) {
    return { isAligned: true };
  }

  const properties = jsonSchema?.properties;
  if (!properties || Object.keys(properties).length === 0) {
    // No properties to check alignment on -- structural check handles this
    return { isAligned: true };
  }

  // CSV and Excel always produce flat arrays of objects
  if (fileType === 'CSV' || fileType === 'Excel') {
    for (const [, prop] of Object.entries(properties)) {
      const p = prop as any;
      if (p.type === 'object') {
        return {
          isAligned: false,
          reason: 'completeness.schemaAlignment.nestedObjectInCsv',
        };
      }
      if (p.type === 'array') {
        return {
          isAligned: false,
          reason: 'completeness.schemaAlignment.arrayInCsv',
        };
      }
    }

    // Soft warning for headerless CSV (not a blocker)
    if (fileType === 'CSV' && hasHeaders === false) {
      return {
        isAligned: true,
        info: 'completeness.schemaAlignment.headerlessInfo',
      };
    }

    return { isAligned: true };
  }

  // XML and JSON: any valid schema structure passes
  // (fileType === 'XML' || fileType === 'JSON' or anything else)
  return { isAligned: true };
}

// ============================================================================
// Tab Field Configuration
// ============================================================================

/**
 * Static configuration mapping each tab to its fields and completeness rules.
 *
 * Field names correspond to actual Form.Item `name` props:
 * - BasicInfoTab: name, supplierName, category, description, retentionDays, isActive
 * - ConnectionTab: connectionType, inputServerId, nasDeviceId, filePath, httpEndpointPath, kafkaTopic, filePattern
 * - FileSettingsTab: fileType, encoding, csvDelimiter, hasHeaders, excelSheet
 * - ScheduleTab: scheduleFrequency, scheduleEnabled, cronExpression
 * - ValidationTab: skipInvalidRecords, maxErrorsAllowed
 * - NotificationsTab: notifyOnSuccess, notifyOnFailure, notificationRecipients
 */
export const TAB_FIELD_CONFIG: Record<string, TabFieldConfig> = {
  // ---- REQUIRED TABS ----
  basic: {
    tier: 'required',
    fields: [
      { name: 'name', required: true },
      { name: 'supplierName', required: true },
      { name: 'category', required: true },
      { name: 'description', required: false },
      { name: 'retentionDays', required: false },
      { name: 'isActive', required: false },
    ],
  },

  connection: {
    tier: 'required',
    fields: [
      { name: 'connectionType', required: true },
      // File-based protocols (FTP, SFTP, S3) require a file path
      {
        name: 'filePath',
        required: true,
        when: (v) => ['FTP', 'SFTP', 'S3', 'Local'].includes(v.connectionType),
      },
      // HTTP requires an endpoint path
      {
        name: 'httpEndpointPath',
        required: true,
        when: (v) => v.connectionType === 'HTTP',
      },
      // Non-NAS, non-Local protocols require a server selection
      {
        name: 'inputServerId',
        required: true,
        when: (v) => ['FTP', 'SFTP', 'HTTP', 'Kafka', 'S3'].includes(v.connectionType),
      },
      // NAS protocol requires device selection
      {
        name: 'nasDeviceId',
        required: true,
        when: (v) => v.connectionType === 'NAS',
      },
      // Kafka requires a topic
      {
        name: 'kafkaTopic',
        required: true,
        when: (v) => v.connectionType === 'Kafka',
      },
    ],
  },

  file: {
    tier: 'required',
    fields: [
      { name: 'fileType', required: true },
      { name: 'encoding', required: false },
      // CSV-specific fields have defaults, so not required for completeness
    ],
  },

  schema: {
    tier: 'required',
    nonFormCheck: (jsonSchema: any, _outputConfig: any, formValues?: Record<string, any>) => {
      // D-11: At least 1 property with a type defined
      const properties = jsonSchema?.properties;
      if (!properties) return false;

      const propEntries = Object.entries(properties);
      if (propEntries.length === 0) return false;

      // Every property must have a `type` defined
      const allTyped = propEntries.every(([, prop]: [string, any]) => prop.type !== undefined);
      if (!allTyped) return false;

      // D-22/D-23: Schema-filetype alignment check
      const fileType = formValues?.fileType;
      const hasHeaders = formValues?.hasHeaders;
      const alignment = checkSchemaFileTypeAlignment(jsonSchema, fileType, hasHeaders);

      return alignment.isAligned;
    },
  },

  // ---- RECOMMENDED TABS ----
  schedule: {
    tier: 'recommended',
    fields: [
      { name: 'scheduleFrequency', required: true },
      { name: 'scheduleEnabled', required: false },
      { name: 'cronExpression', required: false },
    ],
  },

  output: {
    tier: 'recommended',
    nonFormCheck: (_jsonSchema: any, outputConfig: any) => {
      return (outputConfig?.destinations?.length || 0) > 0;
    },
  },

  metrics: {
    tier: 'recommended',
    // Metrics are only available in edit mode (requires datasource ID).
    // In create mode, this tab is unavailable and skipped.
    // In edit mode, we consider it "complete" if the datasource exists
    // (metrics can always be configured later).
    nonFormCheck: () => {
      // This is intentionally permissive -- metrics availability is handled
      // by the hook which skips this tab in create mode.
      return false;
    },
  },

  // ---- OPTIONAL TABS ----
  validation: {
    tier: 'optional',
    fields: [
      { name: 'skipInvalidRecords', required: false },
      { name: 'maxErrorsAllowed', required: false },
    ],
  },

  notifications: {
    tier: 'optional',
    fields: [
      { name: 'notifyOnSuccess', required: false },
      { name: 'notifyOnFailure', required: false },
      { name: 'notificationRecipients', required: false },
    ],
  },
};

// ============================================================================
// Tab Classification Constants
// ============================================================================

/** Tabs that must be fully complete for a datasource to be enabled */
export const REQUIRED_TABS = ['basic', 'connection', 'file', 'schema'] as const;

/** Tabs tracked by the secondary "recommended" indicator */
export const RECOMMENDED_TABS = ['schedule', 'output', 'metrics'] as const;

/** Tabs that are purely informational (never counted in percentages) */
export const OPTIONAL_TABS = ['validation', 'notifications'] as const;

// ============================================================================
// Tab Metadata (labels and icons)
// ============================================================================

/** Display metadata for each tab: i18n label key and Ant Design icon name */
export const TAB_META: Record<string, { labelKey: string; icon: string }> = {
  basic: { labelKey: 'datasources.tabs.basic', icon: 'FileTextOutlined' },
  connection: { labelKey: 'datasources.tabs.connection', icon: 'ApiOutlined' },
  file: { labelKey: 'datasources.tabs.file', icon: 'FileOutlined' },
  schema: { labelKey: 'datasources.tabs.schema', icon: 'DatabaseOutlined' },
  schedule: { labelKey: 'datasources.tabs.schedule', icon: 'ClockCircleOutlined' },
  validation: { labelKey: 'datasources.tabs.validation', icon: 'SafetyOutlined' },
  notifications: { labelKey: 'datasources.tabs.notifications', icon: 'BellOutlined' },
  output: { labelKey: 'datasources.tabs.output', icon: 'ExportOutlined' },
  metrics: { labelKey: 'datasources.tabs.metrics', icon: 'BarChartOutlined' },
};
