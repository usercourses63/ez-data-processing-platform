/**
 * Completeness Utilities
 *
 * Standalone utility for checking completeness from an API DataSource object.
 * Used by the list page to determine if a datasource can be enabled (D-16/D-17/D-21).
 *
 * Reuses the same field definitions from TAB_FIELD_CONFIG to ensure consistency
 * between the form-side hook and API-side checks.
 */

import { TAB_FIELD_CONFIG, REQUIRED_TABS } from './completenessConfig';

/**
 * Check completeness from an API DataSource response.
 * Parses ConfigurationSettings JSON and evaluates all required tab fields.
 *
 * @param ds - DataSource object from API (PascalCase properties)
 * @returns Completeness status with missing field list
 */
export function checkDataSourceCompleteness(ds: any): {
  isComplete: boolean;
  missingFields: string[];
  requiredPercent: number;
} {
  // Defensive guard for null/undefined datasource (list API may return minimal data)
  if (!ds) return { isComplete: false, missingFields: ['unknown'], requiredPercent: 0 };

  const missingFields: string[] = [];

  // Parse configuration settings
  let parsedConfig: any = {};
  try {
    const configStr =
      ds.AdditionalConfiguration?.ConfigurationSettings ||
      ds.ConfigurationSettings;
    if (configStr && typeof configStr === 'string') {
      parsedConfig = JSON.parse(configStr);
    } else if (configStr && typeof configStr === 'object') {
      parsedConfig = configStr;
    }
  } catch {
    // If config can't be parsed, all config-dependent fields will be missing
  }

  const connectionConfig = parsedConfig.connectionConfig || {};
  const fileConfig = parsedConfig.fileConfig || {};

  // Build a "virtual" form values object from the API data
  // Maps API PascalCase fields to form field names
  const formValues: Record<string, any> = {
    // Basic info
    name: ds.Name,
    supplierName: ds.SupplierName,
    category: ds.Category,
    description: ds.Description,
    retentionDays: ds.AdditionalConfiguration?.RetentionDays,
    isActive: ds.IsActive,

    // Connection
    connectionType: connectionConfig.type,
    filePath: connectionConfig.path || ds.FilePath,
    httpEndpointPath: connectionConfig.url,
    inputServerId: connectionConfig.inputServerId,
    nasDeviceId: connectionConfig.nasDeviceId,
    kafkaTopic: connectionConfig.topic,

    // File settings
    fileType: fileConfig.type,
    encoding: fileConfig.encoding,
    hasHeaders: fileConfig.hasHeaders,

    // Schedule
    scheduleFrequency: ds.ScheduleFrequency || ds.scheduleFrequency,
    scheduleEnabled: ds.ScheduleEnabled || ds.scheduleEnabled,
    cronExpression: ds.CronExpression || ds.cronExpression,
  };

  let totalRequired = 0;
  let filledRequired = 0;

  // Evaluate only required tabs
  for (const tabKey of REQUIRED_TABS) {
    const config = TAB_FIELD_CONFIG[tabKey];
    if (!config) continue;

    if (config.fields) {
      // Form-based tab: evaluate applicable required fields
      const applicableRequired = config.fields.filter((field) => {
        if (!field.required) return false;
        if (field.when && !field.when(formValues)) return false;
        return true;
      });

      for (const field of applicableRequired) {
        totalRequired++;
        const value = formValues[field.name];
        if (value !== undefined && value !== null && value !== '') {
          filledRequired++;
        } else {
          missingFields.push(field.name);
        }
      }
    } else if (config.nonFormCheck) {
      // Non-form tab (schema): evaluate with API data
      totalRequired++;
      const jsonSchema = ds.JsonSchema;
      const outputConfig = ds.Output;
      const result = config.nonFormCheck(jsonSchema, outputConfig, formValues);
      if (result) {
        filledRequired++;
      } else {
        missingFields.push(tabKey);
      }
    }
  }

  const requiredPercent =
    totalRequired > 0 ? Math.round((filledRequired / totalRequired) * 100) : 0;

  return {
    isComplete: missingFields.length === 0 && totalRequired > 0,
    missingFields,
    requiredPercent,
  };
}
