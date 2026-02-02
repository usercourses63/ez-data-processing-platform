# EZ Data Processing Platform - Frontend-Backend Implementation Plan

## Document Overview

**Version:** 1.0  
**Date:** September 30, 2025  
**JSON Schema Version:** 2020-12 (Latest)  
**Frontend Framework:** React 18 + TypeScript + Ant Design  
**Backend Framework:** .NET 9.0 ASP.NET Core + MongoDB.Entities  

## Implementation Order (Following Frontend Menu)

1. **Data Sources Management** ✅ (Partially Complete - needs backend completion)
2. **Schema Management** 🔴 (Priority - Comprehensive Implementation Required)
3. **Metrics Configuration** 🔴 (Complete Implementation)
4. **Invalid Records Management** 🔴 (Complete Implementation)
5. **Dashboard** 🔴 (Complete Implementation)
6. **AI Assistant** 🟡 (Frontend Complete - Backend Required)
7. **Notifications Management** 🔴 (Complete Implementation)

---

## Phase 1: Data Sources Management (Completion)

### Current Status
- ✅ Frontend: List, Form, Edit, Details pages implemented
- 🟡 Backend: Partial implementation (needs completion per shrimp-rules.md tasks)

### Frontend Completion Tasks

#### 1.1 DataSourceForm.tsx Enhancement
**File:** `src/Frontend/src/pages/datasources/DataSourceForm.tsx`

**Requirements:**
- Complete form with all fields from backend entity
- Real-time validation with Hebrew error messages
- Connection test button to verify data source connectivity
- File type selection with specific configuration per type (CSV, Excel, JSON, XML)
- Schedule configuration UI
- Validation rules configuration

**Form Fields:**
```typescript
interface DataSourceFormData {
  name: string;                    // Required, Hebrew/English
  supplierName: string;            // Required
  category: string;                // Dropdown: financial, customers, inventory, sales, operations
  description?: string;            // Optional, textarea
  connectionType: string;          // SFTP, FTP, HTTP, Local
  connectionConfig: {
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    path?: string;
    url?: string;
  };
  fileType: string;                // CSV, Excel, JSON, XML
  fileConfig: {
    delimiter?: string;            // For CSV
    hasHeaders?: boolean;          // For CSV/Excel
    sheetName?: string;            // For Excel
    encoding?: string;             // UTF-8, Windows-1255 (Hebrew), etc.
  };
  schedule: {
    frequency: string;             // Manual, Hourly, Daily, Weekly
    cronExpression?: string;       // For custom schedules
    enabled: boolean;
  };
  validationRules: {
    schemaId?: string;            // Link to Schema Management
    skipInvalidRecords: boolean;
    maxErrorsAllowed?: number;
  };
  notificationSettings: {
    onSuccess: boolean;
    onFailure: boolean;
    recipients: string[];
  };
  isActive: boolean;
}
```

**Validation Rules:**
- Name: 2-100 characters, Hebrew/English alphanumeric
- Supplier: 2-50 characters
- Connection test must succeed before saving
- File type configuration must match selected type
- Cron expression validation for custom schedules

**Hebrew Localization Keys Required:**
```json
{
  "datasources": {
    "form": {
      "title": "Create Data Source / צור מקור נתונים",
      "connection": "Connection Settings / הגדרות חיבור",
      "testConnection": "Test Connection / בדוק חיבור",
      "connectionSuccess": "Connection successful / חיבור הצליח",
      "connectionFailed": "Connection failed / חיבור נכשל",
      "fileSettings": "File Settings / הגדרות קובץ",
      "schedule": "Schedule Settings / הגדרות תזמון",
      "validation": "Validation Settings / הגדרות אימות",
      "notifications": "Notification Settings / הגדרות התראות"
    }
  }
}
```

#### 1.2 DataSourceDetails.tsx Enhancement

**Additional Information Panels:**
- Connection status and last connection test
- Processing statistics (files processed, success rate, avg processing time)
- Recent processing history (last 10 runs)
- Active schedule information
- Associated schema details
- Error log summary

### Backend API Completion

**Required Endpoints:**

```csharp
// DataSourceController.cs - Additional endpoints needed

[HttpPost("{id}/test-connection")]
public async Task<IActionResult> TestConnection(string id)
// Test connection to data source without saving

[HttpGet("{id}/statistics")]
public async Task<IActionResult> GetStatistics(string id)
// Get processing statistics for data source

[HttpGet("{id}/history")]
public async Task<IActionResult> GetProcessingHistory(
    string id, 
    [FromQuery] int page = 1, 
    [FromQuery] int size = 10)
// Get recent processing history

[HttpPost("{id}/trigger")]
public async Task<IActionResult> TriggerManualProcessing(string id)
// Manually trigger processing

[HttpPut("{id}/schedule")]
public async Task<IActionResult> UpdateSchedule(
    string id, 
    [FromBody] ScheduleUpdateRequest request)
// Update schedule settings
```

**New Entity Properties:**
```csharp
public class DataProcessingDataSource : DataProcessingBaseEntity
{
    // Existing properties...
    
    // Add:
    public ConnectionConfiguration ConnectionConfig { get; set; }
    public FileConfiguration FileConfig { get; set; }
    public ScheduleConfiguration Schedule { get; set; }
    public ValidationConfiguration ValidationRules { get; set; }
    public NotificationConfiguration NotificationSettings { get; set; }
    public ProcessingStatistics Statistics { get; set; }
    public DateTime? LastConnectionTest { get; set; }
    public bool ConnectionTestPassed { get; set; }
}
```

---

## Phase 2: Schema Management (Comprehensive Implementation)

### Overview
Complete JSON Schema 2020-12 builder with visual and code editors, helper tools, regex calculator/validator, and Hebrew documentation.

### 2.1 Backend Schema Service

**New Service:** `SchemaManagementService`

#### 2.1.1 Entity Model

**File:** `src/Services/Shared/Entities/DataProcessingSchema.cs`

```csharp
public class DataProcessingSchema : DataProcessingBaseEntity
{
    public string Name { get; set; }                    // e.g., "sales_transaction_v2.1"
    public string DisplayName { get; set; }              // Hebrew display name
    public string Description { get; set; }              // Hebrew/English description
    public string DataSourceId { get; set; }             // Reference to data source
    public string Version { get; set; }                  // e.g., "v2.1"
    public SchemaStatus Status { get; set; }             // Draft, Active, Inactive, Archived
    public string JsonSchemaContent { get; set; }        // JSON Schema 2020-12 content
    public List<SchemaField> Fields { get; set; }        // Parsed field definitions
    public SchemaMetadata Metadata { get; set; }         // Additional metadata
    public List<string> Tags { get; set; }               // For categorization
    public DateTime? PublishedAt { get; set; }
    public DateTime? DeprecatedAt { get; set; }
    public string DeprecationReason { get; set; }
    public int UsageCount { get; set; }                  // Number of active data sources using this schema
}

public class SchemaField
{
    public string Name { get; set; }
    public string DisplayName { get; set; }              // Hebrew display name
    public string Type { get; set; }                     // string, number, boolean, array, object
    public bool Required { get; set; }
    public string Description { get; set; }
    public FieldValidation Validation { get; set; }
    public object DefaultValue { get; set; }
    public List<string> Examples { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
}

public class FieldValidation
{
    // String validations
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public string Pattern { get; set; }                  // Regex pattern
    public string Format { get; set; }                   // date-time, email, uuid, etc.
    
    // Number validations
    public decimal? Minimum { get; set; }
    public decimal? Maximum { get; set; }
    public decimal? MultipleOf { get; set; }
    public bool ExclusiveMinimum { get; set; }
    public bool ExclusiveMaximum { get; set; }
    
    // Array validations
    public int? MinItems { get; set; }
    public int? MaxItems { get; set; }
    public bool UniqueItems { get; set; }
    
    // Enum validations
    public List<object> Enum { get; set; }
    
    // Conditional validations
    public Dictionary<string, object> If { get; set; }
    public Dictionary<string, object> Then { get; set; }
    public Dictionary<string, object> Else { get; set; }
}

public class SchemaMetadata
{
    public string Author { get; set; }
    public string Category { get; set; }
    public List<string> RelatedSchemas { get; set; }
    public string DocumentationUrl { get; set; }
    public Dictionary<string, string> CustomProperties { get; set; }
}

public enum SchemaStatus
{
    Draft,
    Active,
    Inactive,
    Archived
}
```

#### 2.1.2 API Endpoints

**File:** `src/Services/SchemaManagementService/Controllers/SchemaController.cs`

```csharp
[ApiController]
[Route("api/v1/[controller]")]
public class SchemaController : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetSchemas(
        [FromQuery] int page = 1,
        [FromQuery] int size = 25,
        [FromQuery] string? search = null,
        [FromQuery] SchemaStatus? status = null,
        [FromQuery] string? dataSourceId = null)
    // Get paginated list of schemas

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSchema(string id)
    // Get schema by ID

    [HttpPost]
    public async Task<IActionResult> CreateSchema(
        [FromBody] CreateSchemaRequest request)
    // Create new schema

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateSchema(
        string id,
        [FromBody] UpdateSchemaRequest request)
    // Update existing schema

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSchema(
        string id,
        [FromQuery] string deletedBy)
    // Soft delete schema (check if in use first)

    [HttpPost("{id}/validate")]
    public async Task<IActionResult> ValidateData(
        string id,
        [FromBody] object data)
    // Validate sample data against schema

    [HttpPost("{id}/publish")]
    public async Task<IActionResult> PublishSchema(string id)
    // Publish draft schema to active

    [HttpPost("{id}/duplicate")]
    public async Task<IActionResult> DuplicateSchema(
        string id,
        [FromBody] DuplicateSchemaRequest request)
    // Create a copy of schema with new version

    [HttpGet("{id}/usage")]
    public async Task<IActionResult> GetSchemaUsage(string id)
    // Get list of data sources using this schema

    [HttpPost("validate-json-schema")]
    public async Task<IActionResult> ValidateJsonSchema(
        [FromBody] string jsonSchemaContent)
    // Validate JSON Schema 2020-12 syntax

    [HttpPost("generate-from-sample")]
    public async Task<IActionResult> GenerateSchemaFromSample(
        [FromBody] object sampleData)
    // Auto-generate schema from sample data

    [HttpGet("templates")]
    public async Task<IActionResult> GetSchemaTemplates()
    // Get pre-built schema templates

    [HttpPost("regex/test")]
    public async Task<IActionResult> TestRegex(
        [FromBody] RegexTestRequest request)
    // Test regex pattern against sample strings

    [HttpPost("regex/generate")]
    public async Task<IActionResult> GenerateRegex(
        [FromBody] RegexGenerateRequest request)
    // Generate regex from requirements
}
```

#### 2.1.3 Schema Validation Service

**File:** `src/Services/SchemaManagementService/Services/SchemaValidationService.cs`

```csharp
public interface ISchemaValidationService
{
    Task<ValidationResult> ValidateJsonSchema(string jsonSchemaContent);
    Task<DataValidationResult> ValidateDataAgainstSchema(string schemaId, object data);
    Task<RegexTestResult> TestRegexPattern(string pattern, List<string> testStrings);
    Task<string> GenerateRegexFromRequirements(RegexRequirements requirements);
    Task<DataProcessingSchema> GenerateSchemaFromSample(object sampleData);
}

public class SchemaValidationService : ISchemaValidationService
{
    // Implement using Json.NET Schema or similar library
    // Support JSON Schema 2020-12 specification
}
```

### 2.2 Frontend Schema Management

#### 2.2.1 Main Schema Management Page

**File:** `src/Frontend/src/pages/schema/SchemaManagement.tsx` (Complete Rewrite)

**Page Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  Schema Management / ניהול Schema                       │
│  [+ New Schema] [Import] [Export] [Templates]          │
├─────────────────────────────────────────────────────────┤
│  Search: [___________] Filter: [Status▾] [Type▾]       │
├─────────────────────────────────────────────────────────┤
│  Schemas Table                                          │
│  ┌────┬─────────┬────────┬────────┬─────────┐          │
│  │Name│Data Src │Version │Status  │Actions  │          │
│  ├────┼─────────┼────────┼────────┼─────────┤          │
│  │... │...      │...     │...     │View Edit│          │
│  └────┴─────────┴────────┴────────┴─────────┘          │
└─────────────────────────────────────────────────────────┘
```

#### 2.2.2 Schema Builder/Editor

**File:** `src/Frontend/src/pages/schema/SchemaBuilder.tsx` (New)

**Features:**

**Visual Builder Tab:**
- Drag-and-drop field builder
- Field type selector (string, number, boolean, array, object, null)
- Property panels for each field type
- Nested object support
- Array items configuration
- Real-time preview of generated JSON Schema

**JSON Editor Tab:**
- Monaco Editor with JSON Schema 2020-12 syntax highlighting
- Auto-completion for JSON Schema keywords
- Real-time validation
- Schema formatting and prettification
- Import/Export functionality

**Validation Tab:**
- Sample data input
- Real-time validation against schema
- Error highlighting and explanations in Hebrew
- Validation results display

**Documentation Tab:**
- Generated documentation from schema
- Field descriptions in Hebrew/English
- Required fields listing
- Validation rules summary
- Examples section

#### 2.2.3 Field Configuration Dialog

**Component:** `src/Frontend/src/components/schema/FieldConfigDialog.tsx` (New)

**String Field Configuration:**
```typescript
interface StringFieldConfig {
  name: string;
  displayName: string;          // Hebrew name
  description: string;
  required: boolean;
  
  // Basic constraints
  minLength?: number;
  maxLength?: number;
  
  // Pattern validation
  pattern?: string;              // Regex pattern
  format?: 'date-time' | 'date' | 'time' | 'email' | 'ipv4' | 'ipv6' | 'uuid' | 'uri' | 'hostname';
  
  // Enum values
  enum?: string[];
  
  // Default and examples
  default?: string;
  examples?: string[];
  
  // Custom validation
  customValidation?: CustomValidation;
}
```

**UI Components:**
- Pattern input with [Regex Helper] button
- Format dropdown with format explanations in Hebrew
- Enum builder with add/remove functionality
- Min/Max length sliders with live character counter

#### 2.2.4 Regex Helper Dialog

**Component:** `src/Frontend/src/components/schema/RegexHelperDialog.tsx` (New)

**Features:**

**1. Common Patterns Library:**
```typescript
const commonPatterns = {
  israeliId: {
    name: "תעודת זהות / Israeli ID",
    pattern: "^[0-9]{9}$",
    description: "9 digits Israeli ID number",
    examples: ["123456789", "987654321"]
  },
  israeliPhone: {
    name: "מספר טלפון ישראלי / Israeli Phone",
    pattern: "^0[2-9][0-9]{7,8}$",
    description: "Israeli phone number (landline or mobile)",
    examples: ["025551234", "0501234567"]
  },
  hebrewText: {
    name: "טקסט עברי / Hebrew Text",
    pattern: "^[\u0590-\u05FF\\s]+$",
    description: "Hebrew characters and spaces only",
    examples: ["שלום עולם", "ישראל"]
  },
  email: {
    name: "דוא\"ל / Email",
    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    description: "Valid email address",
    examples: ["user@example.com", "test@domain.co.il"]
  },
  url: {
    name: "כתובת אתר / URL",
    pattern: "^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}.*$",
    description: "HTTP/HTTPS URL",
    examples: ["https://example.com", "http://site.co.il/page"]
  },
  creditCard: {
    name: "כרטיס אשראי / Credit Card",
    pattern: "^[0-9]{13,19}$",
    description: "Credit card number (13-19 digits)",
    examples: ["4111111111111111", "5500000000000004"]
  },
  postalCode: {
    name: "מיקוד / Postal Code",
    pattern: "^[0-9]{5,7}$",
    description: "Israeli postal code",
    examples: ["12345", "1234567"]
  },
  date: {
    name: "תאריך / Date",
    pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
    description: "Date in YYYY-MM-DD format",
    examples: ["2025-09-30", "2024-01-15"]
  }
};
```

**2. Pattern Builder:**
- Character classes (digits, letters, Hebrew, alphanumeric)
- Quantifiers (exact, range, one or more, zero or more)
- Anchors (start, end)
- Groups and alternatives
- Visual pattern construction

**3. Pattern Tester:**
```
┌─────────────────────────────────────────────┐
│ Pattern: [^0[2-9][0-9]{7,8}$___________]   │
│                                             │
│ Test Strings:                               │
│ ┌─────────────────────────────────────────┐ │
│ │ 025551234          ✓ Match             │ │
│ │ 0501234567         ✓ Match             │ │
│ │ 1234567            ✗ No Match          │ │
│ │ 050-123-4567       ✗ No Match          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Add Test String] [Test All]                │
│                                             │
│ Explanation: (in Hebrew)                    │
│ התבנית תואמת מספרי טלפון ישראליים...      │
└─────────────────────────────────────────────┘
```

**4. AI-Assisted Pattern Generation:**
- Natural language description in Hebrew/English
- Generate regex from description
- Example: "מספר חשבון בנק בן 10 ספרות" → "^[0-9]{10}$"

#### 2.2.5 Number Field Configuration

**Component:** `src/Frontend/src/components/schema/NumberFieldConfig.tsx` (New)

**UI Elements:**
- Minimum/Maximum with sliders and input
- Exclusive minimum/maximum checkboxes
- Multiple of (divisibility) input
- Default value selector
- Visual range indicator

#### 2.2.6 Array/Object Configuration

**Component:** `src/Frontend/src/components/schema/ArrayObjectConfig.tsx` (New)

**Array Configuration:**
- Item type selector (single type or tuple)
- Min/Max items constraints
- Unique items toggle
- Contains validation
- Prefix items configuration (for tuples)

**Object Configuration:**
- Nested properties builder
- Required properties selector
- Additional properties toggle
- Property name patterns
- Min/Max properties constraints

#### 2.2.7 Schema Templates

**Component:** `src/Frontend/src/pages/schema/SchemaTemplates.tsx` (New)

**Pre-built Templates:**

1. **Financial Transaction Schema**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Financial Transaction",
  "type": "object",
  "properties": {
    "transactionId": {
      "type": "string",
      "pattern": "^TXN-[0-9]{8}$",
      "description": "מזהה עסקה ייחודי"
    },
    "amount": {
      "type": "number",
      "minimum": 0,
      "maximum": 999999.99,
      "description": "סכום העסקה"
    },
    "currency": {
      "type": "string",
      "enum": ["ILS", "USD", "EUR"],
      "default": "ILS"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    }
  },
  "required": ["transactionId", "amount", "currency", "timestamp"]
}
```

2. **Customer Record Schema**
3. **Inventory Item Schema**
4. **Sales Order Schema**
5. **Employee Record Schema**

### 2.3 Schema Documentation Generator

**Component:** `src/Frontend/src/components/schema/SchemaDocumentation.tsx` (New)

**Features:**
- Auto-generate Hebrew/English documentation
- Markdown export
- HTML export with styling
- PDF export option
- Include field descriptions, constraints, examples
- Validation rules explanation in plain language

**Hebrew Documentation Example:**
```markdown
# Schema: sales_transaction_v2.1

## תיאור
Schema לעסקאות מכירה כולל אמצעי תשלום חדשים

## שדות

### transactionId (חובה)
- **סוג:** מחרוזת
- **תיאור:** מזהה עסקה ייחודי
- **תבנית:** TXN-XXXXXXXX (שמונה ספרות)
- **דוגמה:** TXN-20250930

### amount (חובה)
- **סוג:** מספר
- **תיאור:** סכום העסקה בשקלים
- **מינימום:** 0
- **מקסימום:** 999999.99
- **דוגמה:** 125.50

### paymentMethod (חובה)
- **סוג:** מחרוזת (enum)
- **תיאור:** אמצעי התשלום
- **ערכים אפשריים:**
  - CREDIT_CARD (כרטיס אשראי)
  - DEBIT_CARD (כרטיס חיוב)
  - CASH (מזומן)
  - CRYPTO (מטבע דיגיטלי)
```

### 2.4 Hebrew Localization for Schema Management

**File:** `src/Frontend/src/i18n/locales/he.json` (Add section)

```json
{
  "schema": {
    "title": "ניהול Schema",
    "subtitle": "צור ונהל schemas לאימות נתונים",
    "create": "צור Schema חדש",
    "edit": "ערוך Schema",
    "delete": "מחק Schema",
    "duplicate": "שכפל Schema",
    "publish": "פרסם Schema",
    "status": {
      "draft": "טיוטה",
      "active": "פעיל",
      "inactive": "לא פעיל",
      "archived": "בארכיון"
    },
    "builder": {
      "visualEditor": "עורך חזותי",
      "jsonEditor": "עורך JSON",
      "validation": "אימות",
      "documentation": "תיעוד",
      "addField": "הוסף שדה",
      "removeField": "הסר שדה",
      "fieldName": "שם השדה",
      "fieldType": "סוג השדה",
      "required": "שדה חובה",
      "optional": "שדה רשות"
    },
    "types": {
      "string": "מחרוזת",
      "number": "מספר",
      "integer": "מספר שלם",
      "boolean": "בוליאני",
      "array": "מערך",
      "object": "אובייקט",
      "null": "null"
    },
    "validation": {
      "minLength": "אורך מינימלי",
      "maxLength": "אורך מקסימלי",
      "pattern": "תבנית (Regex)",
      "format": "פורמט",
      "minimum": "ערך מינימלי",
      "maximum": "ערך מקסימלי",
      "enum": "ערכים אפשריים"
    },
    "regex": {
      "title": "עזרת Regex",
      "pattern": "תבנית",
      "test": "בדוק תבנית",
      "commonPatterns": "תבניות נפוצות",
      "patternBuilder": "בונה תבניות",
      "testStrings": "מחרוזות לבדיקה",
      "matches": "תואם",
      "noMatch": "לא תואם",
      "explanation": "הסבר",
      "generate": "צור תבנית",
      "describe": "תאר את הדרישות..."
    },
    "templates": {
      "title": "תבניות Schema",
      "financial": "עסקאות פיננסיות",
      "customer": "רשומות לקוחות",
      "inventory": "פריטי מלאי",
      "sales": "הזמנות מכירה",
      "employee": "רשומות עובדים",
      "useTemplate": "השתמש בתבנית"
    },
    "messages": {
      "createSuccess": "Schema נוצר בהצלחה",
      "updateSuccess": "Schema עודכן בהצלחה",
      "deleteSuccess": "Schema נמחק בהצלחה",
      "publishSuccess": "Schema פורסם בהצלחה",
      "validationSuccess": "הנתונים תקינים",
      "validationFailed": "הנתונים אינם תואמים את ה-Schema",
      "invalidJsonSchema": "JSON Schema לא תקין",
      "schemaInUse": "לא ניתן למחוק Schema בשימוש"
    }
  }
}
```

---

## Phase 3: Metrics Configuration

### 3.1 Backend Metrics Service

**New Service:** `MetricsConfigurationService`

#### 3.1.1 Entity Model

**File:** `src/Services/Shared/Entities/DataProcessingMetricConfiguration.cs`

```csharp
public class DataProcessingMetricConfiguration : DataProcessingBaseEntity
{
    public string Name { get; set; }
    public string DisplayName { get; set; }
    public string Description { get; set; }
    public string DataSourceId { get; set; }
    public MetricType Type { get; set; }
    public string AggregationField { get; set; }
    public AggregationType Aggregation { get; set; }
    public List<MetricFilter> Filters { get; set; }
    public string GroupByField { get; set; }
    public TimeWindow TimeWindow { get; set; }
    public List<MetricAlert> Alerts { get; set; }
    public bool IsActive { get; set; }
    public int RefreshInterval { get; set; }  // In seconds
}

public enum MetricType
{
    Count,
    Sum,
    Average,
    Min,
    Max,
    Percentage,
    Custom
}

public enum AggregationType
{
    Hourly,
    Daily,
    Weekly,
    Monthly,
    RealTime
}

public class MetricFilter
{
    public string Field { get; set; }
    public string Operator { get; set; }  // equals, contains, gt, lt, etc.
    public object Value { get; set; }
}

public class MetricAlert
{
    public string Name { get; set; }
    public AlertCondition Condition { get; set; }
    public decimal Threshold { get; set; }
    public List<string> Recipients { get; set; }
    public AlertSeverity Severity { get; set; }
}

public enum AlertCondition
{
    GreaterThan,
    LessThan,
    Equals,
    NotEquals
}

public enum AlertSeverity
{
    Info,
    Warning,
    Error,
    Critical
}
```

#### 3.1.2 API Endpoints

```csharp
[HttpGet]
public async Task<IActionResult> GetMetricConfigurations()
// Get all metric configurations

[HttpPost]
public async Task<IActionResult> CreateMetricConfiguration(
    [FromBody] CreateMetricConfigurationRequest request)
// Create new metric configuration

[HttpPut("{id}")]
public async Task<IActionResult> UpdateMetricConfiguration(
    string id,
    [FromBody] UpdateMetricConfigurationRequest request)
// Update metric configuration

[HttpGet("{id}/data")]
public async Task<IActionResult> GetMetricData(
    string id,
    [FromQuery] DateTime? from,
    [FromQuery] DateTime? to)
// Get actual metric data

[HttpPost("{id}/preview")]
public async Task<IActionResult> PreviewMet
