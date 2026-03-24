/**
 * Completeness Tracking Engine - Barrel Export
 *
 * Provides the core completeness tracking logic for datasource forms:
 * - Types for completeness state and configuration
 * - Static field configuration for all 9 tabs
 * - React hook for real-time form completeness tracking
 * - UI components: CompletenessPanel sidebar and CompletenessFieldWrapper
 * - Utility for checking completeness from API responses
 */

export * from './types';
export * from './completenessConfig';
export * from './useCompletenessTracker';
export * from './completenessUtils';
export { CompletenessPanel } from './CompletenessPanel';
export { CompletenessFieldWrapper } from './CompletenessFieldWrapper';
