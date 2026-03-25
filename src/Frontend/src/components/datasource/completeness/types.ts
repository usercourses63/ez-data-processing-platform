/**
 * Completeness Tracking Types
 *
 * Defines the type system for the three-tier completeness tracker:
 * - Required tabs: must be filled for datasource to be enabled
 * - Recommended tabs: tracked separately, not blocking
 * - Optional tabs: informational only, never counted
 */

/** Classification tier for a tab */
export type TabTier = 'required' | 'recommended' | 'optional';

/** Status of an individual field in a tab */
export type FieldStatus = 'filled' | 'required-empty' | 'optional-empty';

/** Configuration for a single form field's completeness tracking */
export interface FieldConfig {
  /** Form.Item name attribute (must match exactly) */
  name: string;
  /** Whether filling this field is required for tab completeness */
  required: boolean;
  /** Optional condition: field is only applicable when this returns true */
  when?: (formValues: Record<string, any>) => boolean;
}

/** Configuration for a tab's completeness evaluation */
export interface TabFieldConfig {
  /** Tier classification for this tab */
  tier: TabTier;
  /** Form fields to track (for form-based tabs) */
  fields?: FieldConfig[];
  /**
   * Non-form completeness check (for schema, output, metrics tabs).
   * Receives jsonSchema, outputConfig, and optionally formValues.
   * Returns true if complete, or a string reason if incomplete (i18n key).
   */
  nonFormCheck?: (jsonSchema: any, outputConfig: any, formValues?: Record<string, any>) => boolean | string;
}

/** Completeness status for a single tab */
export interface TabCompleteness {
  /** Tab key (e.g., 'basic', 'connection') */
  key: string;
  /** i18n label key for display */
  label: string;
  /** Tab tier classification */
  tier: TabTier;
  /** Number of applicable required fields that are filled */
  filledCount: number;
  /** Total number of applicable required fields */
  totalCount: number;
  /** Whether this tab is fully complete */
  isComplete: boolean;
  /** Ant Design icon component name */
  icon: string;
}

/** Overall completeness state for the entire form */
export interface CompletenessState {
  /** Percentage of required tab fields filled (0-100) */
  requiredPercent: number;
  /** Percentage of recommended tab fields filled (0-100) */
  recommendedPercent: number;
  /** Per-tab completeness details */
  tabs: TabCompleteness[];
  /** True when all required fields across all required tabs are filled */
  isFullyComplete: boolean;
  /** List of field names that are required but still missing */
  missingFields: string[];
}
