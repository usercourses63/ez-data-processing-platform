---
last-verified: 2026-02-02
status: current
---
# React Infinite Loop Bug Fix

## Problem Description
React application was experiencing "Maximum update depth exceeded" error when using the metric configuration wizard, specifically when changing the Prometheus type or interacting with field selection.

## Root Cause Analysis

The infinite loop was caused by **unstable callback references** in the component hierarchy:

1. **WizardStepField.tsx**: Event handler callbacks were recreated on every render
2. **WizardStepDataSource.tsx**: Event handler callbacks were recreated on every render  
3. **SchemaFieldSelector.tsx**: useEffect had suppressed dependency warnings causing stale closures
4. When state changed (e.g., `prometheusType`), components re-rendered with new callback instances
5. These new callbacks triggered child component re-renders
6. Child components with unstable dependencies caused infinite re-render loops

## Files Modified

### 1. src/Frontend/src/components/metrics/WizardStepField.tsx
**Changes:**
- Added `useCallback` to `handleFieldSelect` with `[onChange]` dependencies
- Added `useCallback` to `handlePrometheusTypeChange` with `[onChange]` dependencies
- Added `useCallback` to `handleLabelsSelect` with empty dependencies (no-op function)

**Why:** Prevents callbacks from being recreated on every render, maintaining stable references

### 2. src/Frontend/src/components/metrics/SchemaFieldSelector.tsx
**Changes:**
- Fixed useEffect dependencies to properly include `fetchSchema` and `fetchSchemaMetrics`
- Removed the `eslint-disable-next-line react-hooks/exhaustive-deps` suppression comment

**Why:** Ensures useEffect runs correctly when dependencies change and prevents stale closures

### 3. src/Frontend/src/components/metrics/WizardStepDataSource.tsx
**Changes:**
- Added `useCallback` to `loadDataSources` with empty dependencies
- Updated useEffect to include `loadDataSources` in dependency array
- Added `useCallback` to `handleScopeChange` with `[onChange]` dependencies
- Added `useCallback` to `handleDataSourceSelect` with `[onChange, dataSources]` dependencies
- Fixed `handleDataSourceSelect` to also pass `dataSourceName` to onChange

**Why:** Prevents repeated API calls and maintains stable callback references

## Technical Explanation

### useCallback Hook
`useCallback` memoizes callback functions, returning the same function reference across renders unless dependencies change:

```typescript
const handleClick = useCallback((value: string) => {
  onChange({ fieldPath: value });
}, [onChange]); // Only recreate if onChange changes
```

### Dependency Arrays
Proper dependency arrays ensure:
- Effects run when they should
- No stale closures capture old values
- No unnecessary re-renders

## Verification

✅ Frontend compiled successfully with no errors  
✅ No TypeScript errors  
✅ Webpack bundle completed successfully  
✅ React hooks warnings resolved  
✅ Datasource API calls no longer repeat infinitely

## Impact

The fix ensures:
- Metric wizard works properly without crashes
- Better performance due to fewer unnecessary re-renders
- Proper React hooks best practices followed
- Stable component behavior across state changes

## Testing Recommendations

1. Open metric wizard and create a new datasource-specific metric
2. Change Prometheus type from "Gauge" to "Counter" 
3. Select different fields from schema
4. Verify no infinite loop errors occur
5. Check browser console for any React warnings

## Prevention

To prevent similar issues in the future:
- Always use `useCallback` for event handlers passed as props
- Include all dependencies in useEffect dependency arrays
- Don't suppress ESLint React hooks warnings without understanding why
- Test state changes that trigger parent-child component updates
