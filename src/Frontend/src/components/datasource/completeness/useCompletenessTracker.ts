/**
 * useCompletenessTracker Hook
 *
 * Computes real-time completeness state from Ant Design Form values and
 * non-form state (jsonSchema, outputConfig). Designed to be called via
 * Form's onValuesChange callback to avoid re-render storms from useWatch.
 *
 * Handles lazy-loaded tabs by merging form values with initialValues so
 * that unvisited tabs still report correct completeness.
 */

import { useState, useEffect, useCallback } from 'react';
import type { FormInstance } from 'antd/es/form';
import type { CompletenessState, TabCompleteness, FieldStatus, FieldConfig } from './types';
import { TAB_FIELD_CONFIG, TAB_META, REQUIRED_TABS, RECOMMENDED_TABS } from './completenessConfig';

/** Initial empty completeness state */
function createInitialState(): CompletenessState {
  const tabs: TabCompleteness[] = Object.entries(TAB_FIELD_CONFIG).map(([key, config]) => ({
    key,
    label: TAB_META[key]?.labelKey || key,
    tier: config.tier,
    filledCount: 0,
    totalCount: config.fields?.filter((f) => f.required).length || (config.nonFormCheck ? 1 : 0),
    isComplete: false,
    icon: TAB_META[key]?.icon || 'FileTextOutlined',
  }));

  return {
    requiredPercent: 0,
    recommendedPercent: 0,
    tabs,
    isFullyComplete: false,
    missingFields: [],
  };
}

/**
 * Check if a form value is considered "filled" (non-empty).
 * Handles various falsy edge cases:
 * - undefined/null/empty string = not filled
 * - false for switches = filled (it's a deliberate choice)
 * - 0 for numbers = filled (it's a valid value)
 */
function isFieldFilled(value: any): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  // Booleans, numbers, objects, arrays are all considered "filled"
  return true;
}

/**
 * Determine which fields are applicable for a tab given current form values.
 * Evaluates `when` conditions to filter out fields that don't apply.
 */
function getApplicableFields(
  fields: FieldConfig[],
  formValues: Record<string, any>
): FieldConfig[] {
  return fields.filter((field) => {
    if (!field.when) return true;
    return field.when(formValues);
  });
}

/**
 * Core computation: evaluate completeness for all tabs.
 */
function computeCompleteness(
  allValues: Record<string, any>,
  jsonSchema: any,
  outputConfig: any,
  isEditMode: boolean
): CompletenessState {
  const tabs: TabCompleteness[] = [];
  const missingFields: string[] = [];

  let requiredFilled = 0;
  let requiredTotal = 0;
  let recommendedFilled = 0;
  let recommendedTotal = 0;

  for (const [tabKey, config] of Object.entries(TAB_FIELD_CONFIG)) {
    let filledCount = 0;
    let totalCount = 0;
    let isComplete = false;

    // Skip metrics tab in create mode
    if (tabKey === 'metrics' && !isEditMode) {
      tabs.push({
        key: tabKey,
        label: TAB_META[tabKey]?.labelKey || tabKey,
        tier: config.tier,
        filledCount: 0,
        totalCount: 0,
        isComplete: false,
        icon: TAB_META[tabKey]?.icon || 'FileTextOutlined',
      });
      continue;
    }

    if (config.fields) {
      // Form-based tab: evaluate fields
      const applicableFields = getApplicableFields(config.fields, allValues);
      const requiredApplicable = applicableFields.filter((f) => f.required);

      totalCount = requiredApplicable.length;
      filledCount = requiredApplicable.filter((f) => isFieldFilled(allValues[f.name])).length;
      isComplete = totalCount === 0 || filledCount === totalCount;

      // Track missing required fields for required tabs
      if ((REQUIRED_TABS as readonly string[]).includes(tabKey)) {
        for (const field of requiredApplicable) {
          if (!isFieldFilled(allValues[field.name])) {
            missingFields.push(field.name);
          }
        }
      }
    } else if (config.nonFormCheck) {
      // Non-form tab: use custom check function
      totalCount = 1;
      const result = config.nonFormCheck(jsonSchema, outputConfig, allValues);
      filledCount = result ? 1 : 0;
      isComplete = result;

      // Track missing for required non-form tabs
      if ((REQUIRED_TABS as readonly string[]).includes(tabKey) && !isComplete) {
        missingFields.push(tabKey);
      }
    }

    // Accumulate tier totals
    if ((REQUIRED_TABS as readonly string[]).includes(tabKey)) {
      requiredFilled += filledCount;
      requiredTotal += totalCount;
    } else if ((RECOMMENDED_TABS as readonly string[]).includes(tabKey)) {
      recommendedFilled += filledCount;
      recommendedTotal += totalCount;
    }
    // Optional tabs are never counted in percentages

    tabs.push({
      key: tabKey,
      label: TAB_META[tabKey]?.labelKey || tabKey,
      tier: config.tier,
      filledCount,
      totalCount,
      isComplete,
      icon: TAB_META[tabKey]?.icon || 'FileTextOutlined',
    });
  }

  const requiredPercent = requiredTotal > 0 ? Math.round((requiredFilled / requiredTotal) * 100) : 0;
  const recommendedPercent = recommendedTotal > 0 ? Math.round((recommendedFilled / recommendedTotal) * 100) : 0;

  return {
    requiredPercent,
    recommendedPercent,
    tabs,
    isFullyComplete: missingFields.length === 0 && requiredTotal > 0,
    missingFields,
  };
}

/**
 * React hook that tracks form completeness in real-time.
 *
 * @param form - Ant Design FormInstance
 * @param jsonSchema - Current JSON schema (non-form state)
 * @param outputConfig - Current output configuration (non-form state)
 * @param initialValues - Default/loaded values for lazy-loaded tab fields
 * @param isEditMode - Whether this is an edit form (enables metrics tab)
 */
export function useCompletenessTracker(
  form: FormInstance,
  jsonSchema: any,
  outputConfig: any,
  initialValues?: Record<string, any>,
  isEditMode?: boolean
): {
  completeness: CompletenessState;
  recalculate: (changedValues: any, allValues: any) => void;
  getFieldStatus: (tabKey: string, fieldName: string) => FieldStatus;
} {
  const [completeness, setCompleteness] = useState<CompletenessState>(createInitialState);

  /**
   * Merge form values with initialValues to handle lazy-loaded tab fields.
   * Form values take precedence; initialValues fill in gaps for unmounted fields.
   */
  const getMergedValues = useCallback((): Record<string, any> => {
    const formValues = form.getFieldsValue(true);
    return { ...(initialValues || {}), ...formValues };
  }, [form, initialValues]);

  /**
   * Recalculate callback -- called by Form's onValuesChange.
   * allValues from onValuesChange may not include unmounted fields,
   * so we merge with initialValues.
   */
  const recalculate = useCallback(
    (_changedValues: any, allValues: any) => {
      const merged = { ...(initialValues || {}), ...allValues };
      const newState = computeCompleteness(merged, jsonSchema, outputConfig, !!isEditMode);
      setCompleteness(newState);
    },
    [jsonSchema, outputConfig, initialValues, isEditMode]
  );

  /**
   * Recalculate when non-form state changes (schema, output config).
   * Uses form.getFieldsValue(true) merged with initialValues.
   */
  useEffect(() => {
    const merged = getMergedValues();
    const newState = computeCompleteness(merged, jsonSchema, outputConfig, !!isEditMode);
    setCompleteness(newState);
  }, [jsonSchema, outputConfig, getMergedValues, isEditMode]);

  /**
   * Initial calculation on mount.
   */
  useEffect(() => {
    // Small delay to ensure form fields have registered initial values
    const timer = setTimeout(() => {
      const merged = getMergedValues();
      const newState = computeCompleteness(merged, jsonSchema, outputConfig, !!isEditMode);
      setCompleteness(newState);
    }, 100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Get the status of a specific field for border coloring.
   */
  const getFieldStatus = useCallback(
    (tabKey: string, fieldName: string): FieldStatus => {
      const tabConfig = TAB_FIELD_CONFIG[tabKey];
      if (!tabConfig?.fields) return 'optional-empty';

      const merged = getMergedValues();
      const field = tabConfig.fields.find((f) => f.name === fieldName);
      if (!field) return 'optional-empty';

      // Check if field is applicable (when condition)
      if (field.when && !field.when(merged)) {
        return 'optional-empty';
      }

      const value = merged[fieldName];
      if (isFieldFilled(value)) {
        return 'filled';
      }

      return field.required ? 'required-empty' : 'optional-empty';
    },
    [getMergedValues]
  );

  return { completeness, recalculate, getFieldStatus };
}
