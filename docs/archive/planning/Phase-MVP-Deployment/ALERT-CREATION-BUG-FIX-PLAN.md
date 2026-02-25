# Alert Creation Bug Fix + Global Alerts Implementation Plan

**Document:** Session 27-30 Implementation Plan
**Date:** December 23-24, 2025
**Status:** ✅ COMPLETE
**Priority:** High
**Completion:** 100% (8/8 Tasks)

---

## Bug Summary

When creating a new alert at `/alerts`, clicking the "Create Alert" button doesn't save the alert or close the modal.

## Root Cause Analysis

**File:** `src/Frontend/src/pages/alerts/AlertsManagement.tsx`

### Issue 1: Missing Form Validation on Metric Selection (Primary Bug)

The form has `required` validation on name, severity, and expression fields, but **NO validation** on the three metric selection dropdowns. The `handleSaveAlert` function (lines 198-201) manually validates:

```typescript
if (allMetricIds.length === 0) {
  message.error('יש לבחור לפחות Metric אחד');
  return;  // ← Early return - modal stays open
}
```

**Problem:** Manual validation with `message.error()` shows a toast but keeps the modal open. Users don't understand why the button "doesn't work."

### Issue 2: Business/System Metrics Not Implemented

- Business and system metrics are **hardcoded constants** (not in database)
- No backend entity or API exists to persist alerts for these metrics
- Lines 226-227 confirm only datasource metrics are saved

---

## Implementation Phases

### Phase 1: Fix Primary Bug (Frontend Validation)

**Goal:** Fix alert creation button not working

**Tasks:**
1. Add form validation for metric selection (line ~907)
2. Remove redundant manual validation (lines 198-201)
3. Ensure modal closes on successful save

**File:** `src/Frontend/src/pages/alerts/AlertsManagement.tsx`

**Code Change:**
```typescript
rules={[{
  validator: async (_, value) => {
    const businessIds = form.getFieldValue('businessMetricIds') || [];
    const systemIds = form.getFieldValue('systemMetricIds') || [];
    if ([...(value || []), ...businessIds, ...systemIds].length === 0) {
      throw new Error('יש לבחור לפחות Metric אחד');
    }
  }
}]}
dependencies={['businessMetricIds', 'systemMetricIds']}
```

---

### Phase 2: Global Alerts Backend

**Goal:** Create persistence layer for business/system metric alerts

**Files to Create:**
| File | Purpose |
|------|---------|
| `Models/GlobalAlertConfiguration.cs` | MongoDB entity |
| `Repositories/IGlobalAlertRepository.cs` | Repository interface |
| `Repositories/GlobalAlertRepository.cs` | Repository implementation |
| `Controllers/GlobalAlertController.cs` | REST API endpoints |

**Files to Modify:**
| File | Change |
|------|--------|
| `Program.cs` | Register repository in DI |

**Entity Definition:**
```csharp
public class GlobalAlertConfiguration : Entity
{
    public string MetricType { get; set; }      // "business" or "system"
    public string MetricName { get; set; }      // e.g., "business_records_processed_total"
    public string AlertName { get; set; }
    public string? Description { get; set; }
    public string Expression { get; set; }      // PromQL expression
    public string? For { get; set; }            // Duration (5m, 1h)
    public string Severity { get; set; }        // critical/warning/info
    public bool IsEnabled { get; set; }
    public List<string>? NotificationRecipients { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
```

**API Endpoints:**
- `GET /api/v1/global-alerts` - List all
- `GET /api/v1/global-alerts/{id}` - Get by ID
- `POST /api/v1/global-alerts` - Create
- `PUT /api/v1/global-alerts/{id}` - Update
- `DELETE /api/v1/global-alerts/{id}` - Delete

---

### Phase 3: Frontend API Integration

**Goal:** Connect frontend to global alerts API

**Tasks:**
1. Add TypeScript interfaces for GlobalAlertConfiguration
2. Add API methods: `getGlobalAlerts`, `createGlobalAlert`, `updateGlobalAlert`, `deleteGlobalAlert`
3. Update `loadData()` to fetch global alerts
4. Update `handleSaveAlert()` to save business/system alerts via API
5. Update `handleDeleteAlert()` for global alerts

**Files:**
- `src/Frontend/src/services/metrics-api-client.ts`
- `src/Frontend/src/pages/alerts/AlertsManagement.tsx`

---

### Phase 4: Add Missing Metrics + Migrate Legacy

**Goal:** Complete metrics coverage

**New Metrics to Add to BusinessMetrics.cs:**
| Metric Name | Type |
|-------------|------|
| `business_validation_errors_total` | Counter |
| `business_active_datasources_total` | Gauge |
| `business_messages_sent_total` | Counter |
| `business_messages_received_total` | Counter |

**Files:**
- `src/Services/Shared/Monitoring/BusinessMetrics.cs` - Add 4 metrics
- `src/Frontend/src/components/metrics/PromQLExpressionHelperDialog.tsx` - Update GLOBAL_BUSINESS_METRICS
- `src/Services/Shared/Monitoring/DataProcessingMetrics.cs` - Mark as deprecated

---

### Phase 5: Labels UI + Dynamic Variable Substitution

**Goal:** Add labels configuration to alert form and implement runtime `$variable` substitution

#### Part A: Labels UI (Reuse Existing Component)

**Existing Component:** `src/Frontend/src/components/metrics/EnhancedLabelInput.tsx`
- Already used in metrics wizard step 3
- Self-contained, reusable (236 lines)
- Supports dynamic `$variable` and fixed values
- Validates Prometheus label naming rules

**Frontend Tasks:**
1. Import and integrate `EnhancedLabelInput` into alert modal
2. Map component output to alert save payload
3. Display labels as tags in alerts table
4. Support labels in edit mode

#### Part B: Backend Variable Substitution

**File:** `src/Services/MetricsConfigurationService/Services/Alerts/AlertEvaluationService.cs`

**Implementation:**
```csharp
private string SubstituteVariables(string expression, MetricConfiguration metric)
{
    var variables = new Dictionary<string, string?>
    {
        ["$datasource_name"] = metric.DataSourceName,
        ["$datasource_id"] = metric.DataSourceId,
        ["$metric_name"] = metric.Name,
        ["$category"] = metric.Category,
        ["$scope"] = metric.Scope
    };

    var result = expression;
    foreach (var (variable, value) in variables)
    {
        if (!string.IsNullOrEmpty(value))
            result = result.Replace(variable, value);
    }

    return result;
}
```

**Variables Supported:**
| Variable | Source Field | Example Value |
|----------|--------------|---------------|
| `$datasource_name` | `DataSourceName` | "my-csv-source" |
| `$datasource_id` | `DataSourceId` | "6943e116..." |
| `$metric_name` | `Name` | "total_sales" |
| `$category` | `Category` | "כספים" |
| `$scope` | `Scope` | "datasource-specific" |

---

## Files Summary

| File | Action | Phase |
|------|--------|-------|
| `AlertsManagement.tsx` | MODIFY | 1, 3, 5 |
| `GlobalAlertConfiguration.cs` | CREATE | 2 |
| `IGlobalAlertRepository.cs` | CREATE | 2 |
| `GlobalAlertRepository.cs` | CREATE | 2 |
| `GlobalAlertController.cs` | CREATE | 2 |
| `Program.cs` (MetricsConfig) | MODIFY | 2 |
| `metrics-api-client.ts` | MODIFY | 3 |
| `BusinessMetrics.cs` | MODIFY | 4 |
| `PromQLExpressionHelperDialog.tsx` | MODIFY | 4 |
| `DataProcessingMetrics.cs` | DEPRECATE | 4 |
| `AlertEvaluationService.cs` | MODIFY | 5 |
| `EnhancedLabelInput.tsx` | MODIFY | 5 |

---

## Testing Checklist

### Phase 1: Primary Bug Fix ✅ COMPLETE
- [x] Create alert with datasource metric → saves and closes modal
- [x] Create alert with NO metrics → shows inline validation error (not toast)

### Phase 2-3: Global Alerts ✅ COMPLETE
- [x] Create alert with business metric → saves via global API
- [x] Create alert with system metric → saves via global API
- [x] List alerts shows all types (datasource + business + system)
- [x] Edit existing alert works for all types
- [x] Delete alert works for all types

### Phase 4: Metrics Coverage ✅ COMPLETE
- [x] New metrics appear in BusinessMetrics.cs (26 business + 12 system)
- [x] New metrics appear in GLOBAL_BUSINESS_METRICS dropdown
- [x] Legacy DataProcessingMetrics.cs marked as deprecated

### Phase 5: Labels + Dynamic Variables ✅ COMPLETE
- [x] Labels UI appears in alert form
- [x] Available variables shown in dropdown/autocomplete
- [x] Variable `$datasource_name` substitutes correctly in PromQL
- [x] Variable `$category` substitutes correctly (Hebrew support)
- [x] Unsubstituted variables logged as warning
- [x] Labels displayed in alerts table

### Integration Tests (Session 30) ✅ COMPLETE
- [x] GlobalAlertsApiTests: 10/10 tests passing
- [x] AlertVariableSubstitutionTests: 4/4 tests passing
- [x] MetricsEndpointTests: 2/2 tests passing
- [x] Total: 16/16 integration tests passing

---

## Alert Evaluation Architecture (Reference)

**Current State: CODE-BASED EVALUATION**

```
┌────────────────────────────────────────────────────────────┐
│     MetricsConfigurationService                            │
│                                                            │
│  MetricsCollectionBackgroundService (polls every 60s)      │
│       ↓                                                    │
│  AlertEvaluationService.EvaluateAlertsAsync()              │
│       ↓                                                    │
│  PrometheusQueryService.QueryInstantAsync(expression)      │
│       ↓                                                    │
│  If result > 0 → Log warning (notifications NOT impl)      │
└────────────────────────────────────────────────────────────┘
```

**Storage:** MongoDB (alert rules embedded in MetricConfiguration)
**Evaluation:** Application code (C#), NOT Prometheus AlertManager
**State:** In-memory cooldowns (lost on pod restart)
**Notifications:** Logging only (TODO: NotificationService)

---

---

## Completion Summary

**All 5 Phases Complete:**
- ✅ Phase 1: Primary Bug Fix (form validation)
- ✅ Phase 2: Global Alerts Backend (entity, repository, controller)
- ✅ Phase 3: Frontend API Integration
- ✅ Phase 4: Add Missing Metrics (26 business + 12 system)
- ✅ Phase 5: Labels UI + Dynamic Variable Substitution

**Integration Tests:** 16/16 passing
**Git Commits:** 5c32b2d, 2397c3f pushed to main
**MetricsConfigurationService:** Deployed as v7 with all new endpoints

---

*Document Created: Session 27, December 23, 2025*
*Document Completed: Session 30, December 24, 2025*
