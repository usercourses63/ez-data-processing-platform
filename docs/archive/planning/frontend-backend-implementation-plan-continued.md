# Frontend-Backend Implementation Plan (Continued)

## Phase 3: Metrics Configuration (Continued)

#### 3.1.2 API Endpoints (Continued)

```csharp
[HttpPost("{id}/preview")]
public async Task<IActionResult> PreviewMetric(
    string id,
    [FromQuery] int sampleSize = 100)
// Preview metric with sample data

[HttpDelete("{id}")]
public async Task<IActionResult> DeleteMetricConfiguration(
    string id,
    [FromQuery] string deletedBy)
// Delete metric configuration
```

### 3.2 Frontend Metrics Configuration

#### 3.2.1 Main Page

**File:** `src/Frontend/src/pages/metrics/MetricsConfiguration.tsx` (Complete Rewrite)

**Features:**
- List of configured metrics with real-time values
- Create/Edit metric configuration wizard
- Preview charts for each metric
- Alert configuration
- Export metrics data

**Metric Configuration Wizard Steps:**

1. **Basic Information**
   - Metric name and description (Hebrew/English)
   - Data source selection
   - Metric type (Count, Sum, Average, Min, Max, Percentage)

2. **Field Selection**
   - Select field to aggregate
   - Choose aggregation type
   - Set time window

3. **Filters Configuration**
   - Add multiple filters
   - Field dropdown (populated from schema)
   - Operator selection (equals, contains, gt, lt, gte, lte)
   - Value input with validation

4. **Grouping (Optional)**
   - Group by field selection
   - Max groups limit

5. **Alerts Configuration**
   - Add alert conditions
   - Set thresholds
   - Configure recipients
   - Set severity levels

6. **Preview & Save**
   - Preview with sample data
   - Chart visualization
   - Save configuration

---

## Phase 4: Invalid Records Management

### 4.1 Backend Invalid Records Service

#### 4.1.1 Entity Model

**File:** `src/Services/Shared/Entities/DataProcessingInvalidRecord.cs` (Already exists, enhance)

```csharp
public class DataProcessingInvalidRecord : DataProcessingBaseEntity
{
    public string DataSourceId { get; set; }
    public string FileName { get; set; }
    public int LineNumber { get; set; }
    public string RawData { get; set; }
    public List<ValidationError> Errors { get; set; }
    public RecordStatus Status { get; set; }  // New, InReview, Fixed, Ignored
    public string AssignedTo { get; set; }
    public string Resolution { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string ResolvedBy { get; set; }
    public Dictionary<string, object> CorrectedData { get; set; }
}

public class ValidationError
{
    public string Field { get; set; }
    public string ErrorType { get; set; }
    public string Message { get; set; }
    public string MessageHebrew { get; set; }
    public object ExpectedValue { get; set; }
    public object ActualValue { get; set; }
}

public enum RecordStatus
{
    New,
    InReview,
    Fixed,
    Ignored,
    Reprocessed
}
```

#### 4.1.2 API Endpoints

```csharp
[HttpGet]
public async Task<IActionResult> GetInvalidRecords(
    [FromQuery] int page = 1,
    [FromQuery] int size = 25,
    [FromQuery] string? dataSourceId = null,
    [FromQuery] RecordStatus? status = null,
    [FromQuery] DateTime? from = null,
    [FromQuery] DateTime? to = null)

[HttpGet("{id}")]
public async Task<IActionResult> GetInvalidRecord(string id)

[HttpPut("{id}/status")]
public async Task<IActionResult> UpdateStatus(
    string id,
    [FromBody] UpdateStatusRequest request)

[HttpPut("{id}/correct")]
public async Task<IActionResult> CorrectRecord(
    string id,
    [FromBody] CorrectRecordRequest request)

[HttpPost("{id}/reprocess")]
public async Task<IActionResult> ReprocessRecord(string id)

[HttpPost("bulk/reprocess")]
public async Task<IActionResult> BulkReprocess(
    [FromBody] List<string> recordIds)

[HttpPost("bulk/ignore")]
public async Task<IActionResult> BulkIgnore(
    [FromBody] List<string> recordIds,
    [FromBody] string reason)

[HttpGet("statistics")]
public async Task<IActionResult> GetStatistics(
    [FromQuery] string? dataSourceId = null,
    [FromQuery] DateTime? from = null,
    [FromQuery] DateTime? to = null)

[HttpPost("export")]
public async Task<IActionResult> ExportInvalidRecords(
    [FromBody] ExportRequest request)
```

### 4.2 Frontend Invalid Records Management

**File:** `src/Frontend/src/pages/invalid-records/InvalidRecordsManagement.tsx` (Complete Rewrite)

**Features:**

1. **Records Table**
   - Filterable by data source, status, date range
   - Sortable columns
   - Expandable rows showing error details
   - Bulk selection for actions
   - Color-coded by severity

2. **Record Detail View**
   - Raw data display
   - All validation errors with Hebrew translations
   - Correction form
   - History of changes
   - Reprocess button

3. **Correction Form**
   - Field-by-field correction
   - Validation rules display
   - Real-time validation
   - Save corrected data
   - Auto-reprocess option

4. **Bulk Operations**
   - Bulk ignore with reason
   - Bulk reprocess
   - Bulk export
   - Bulk assignment

5. **Statistics Dashboard**
   - Invalid records by data source
   - Invalid records by error type
   - Resolution trends
   - Time to resolution metrics

---

## Phase 5: Dashboard

### 5.1 Backend Dashboard Service

#### 5.1.1 API Endpoints

```csharp
[HttpGet("overview")]
public async Task<IActionResult> GetDashboardOverview()
// Overall system metrics

[HttpGet("datasources/status")]
public async Task<IActionResult> GetDataSourcesStatus()
// Status of all data sources

[HttpGet("processing/recent")]
public async Task<IActionResult> GetRecentProcessing(
    [FromQuery] int limit = 10)
// Recent processing activities

[HttpGet("errors/summary")]
public async Task<IActionResult> GetErrorsSummary()
// Summary of errors by type and source

[HttpGet("performance/metrics")]
public async Task<IActionResult> GetPerformanceMetrics()
// System performance metrics

[HttpGet("alerts/active")]
public async Task<IActionResult> GetActiveAlerts()
// Active alerts and warnings
```

### 5.2 Frontend Dashboard

**File:** `src/Frontend/src/pages/Dashboard.tsx` (Complete Rewrite)

**Dashboard Layout:**

```
┌────────────────────────────────────────────────────────────┐
│  Dashboard / לוח בקרה                                      │
├────────────────────────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┬──────────┐            │
│  │ Active   │ Files    │ Success  │ Invalid  │            │
│  │ Sources  │ Today    │ Rate     │ Records  │            │
│  │   24     │   156    │  98.5%   │   234    │            │
│  └──────────┴──────────┴──────────┴──────────┘            │
├────────────────────────────────────────────────────────────┤
│  ┌────────────────────┬────────────────────────────────┐  │
│  │ Processing Chart   │ Recent Activities              │  │
│  │ (24h trend)        │ • File processed: sales.csv    │  │
│  │                    │ • Schema updated: v2.1         │  │
│  │     [Chart]        │ • Alert: High error rate       │  │
│  │                    │ • 3 invalid records            │  │
│  └────────────────────┴────────────────────────────────┘  │
├────────────────────────────────────────────────────────────┤
│  ┌────────────────────┬────────────────────────────────┐  │
│  │ Data Sources       │ Top Errors                     │  │
│  │ Status             │ 1. Invalid format - 45%        │  │
│  │  ✓ 20 Active       │ 2. Missing field - 30%         │  │
│  │  ⚠ 3 Warnings      │ 3. Range violation - 25%       │  │
│  │  ✗ 1 Failed        │                                │  │
│  └────────────────────┴────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

**Widgets:**
- System overview cards
- Processing trend chart (Recharts)
- Data sources health status
- Recent activities timeline
- Top errors breakdown
- Active alerts panel
- Quick actions menu

**Refresh Options:**
- Auto-refresh toggle
- Refresh interval selector (10s, 30s, 1m, 5m)
- Manual refresh button

---

## Phase 6: AI Assistant (Backend Completion)

### 6.1 Backend AI Chat Service

**Service:** `DataSourceChatService` (Already has project file, needs implementation)

#### 6.1.1 Entity Models

**File:** `src/Services/Shared/Entities/DataProcessingChatConversation.cs`

```csharp
public class DataProcessingChatConversation : DataProcessingBaseEntity
{
    public string UserId { get; set; }
    public string Title { get; set; }
    public List<ChatMessage> Messages { get; set; }
    public ConversationContext Context { get; set; }
    public DateTime LastMessageAt { get; set; }
    public bool IsArchived { get; set; }
}

public class ChatMessage
{
    public string Id { get; set; }
    public string Role { get; set; }  // user, assistant, system
    public string Content { get; set; }
    public DateTime Timestamp { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
}

public class ConversationContext
{
    public string? CurrentDataSourceId { get; set; }
    public string? CurrentSchemaId { get; set; }
    public List<string> ReferencedEntities { get; set; }
}
```

#### 6.1.2 API Endpoints

```csharp
[HttpGet("conversations")]
public async Task<IActionResult> GetConversations(
    [FromQuery] string userId,
    [FromQuery] bool includeArchived = false)

[HttpGet("conversations/{id}")]
public async Task<IActionResult> GetConversation(string id)

[HttpPost("conversations")]
public async Task<IActionResult> CreateConversation(
    [FromBody] CreateConversationRequest request)

[HttpPost("conversations/{id}/messages")]
public async Task<IActionResult> SendMessage(
    string id,
    [FromBody] SendMessageRequest request)
// Send message and get AI response

[HttpDelete("conversations/{id}")]
public async Task<IActionResult> DeleteConversation(string id)

[HttpPut("conversations/{id}/archive")]
public async Task<IActionResult> ArchiveConversation(string id)

[HttpPost("quick-actions/{action}")]
public async Task<IActionResult> ExecuteQuickAction(
    string action,
    [FromBody] QuickActionRequest request)
// Execute predefined quick actions
```

#### 6.1.3 OpenAI Integration Service

**File:** `src/Services/DataSourceChatService/Services/OpenAIService.cs`

```csharp
public interface IOpenAIService
{
    Task<string> GetChatCompletion(
        List<ChatMessage> messages,
        ConversationContext context);
    
    Task<string> GenerateSchemaExplanation(string schemaId);
    Task<string> AnalyzeInvalidRecords(string dataSourceId);
    Task<string> SuggestSchemaImprovements(string schemaId);
}

public class OpenAIService : IOpenAIService
{
    private readonly OpenAIClient _client;
    private readonly IDataSourceService _dataSourceService;
    private readonly ISchemaService _schemaService;
    
    // System prompt optimized for data processing domain
    private const string SystemPrompt = @"
You are an AI assistant specialized in data processing and validation for the EZ Data Processing Platform.
You help users with:
- Understanding and creating JSON schemas
- Analyzing data validation errors
- Suggesting improvements to data sources
- Explaining system metrics and patterns

Respond in Hebrew when the user writes in Hebrew, and in English when they write in English.
Be concise, accurate, and helpful.
";
}
```

### 6.2 Frontend AI Assistant Enhancements

**File:** `src/Frontend/src/pages/ai-assistant/AIAssistant.tsx` (Already well-implemented, enhance)

**Additional Features:**

1. **Context-Aware Conversations**
   - Auto-include current page context
   - Reference entities from other pages
   - Link to data sources, schemas, invalid records

2. **Quick Action Buttons** (Already has mockups, make functional)
   - "Explain this schema" → API call
   - "Analyze errors" → API call
   - "Suggest improvements" → API call
   - "Generate validation rules" → API call

3. **Code Snippets**
   - Syntax highlighting for JSON Schema
   - Copy to clipboard
   - Apply directly to schema builder

4. **Conversation Management**
   - Save/Load conversations
   - Archive old conversations
   - Search conversation history

---

## Phase 7: Notifications Management

### 7.1 Backend Notifications Service

**New Service:** `NotificationsService`

#### 7.1.1 Entity Model

**File:** `src/Services/Shared/Entities/DataProcessingNotification.cs`

```csharp
public class DataProcessingNotification : DataProcessingBaseEntity
{
    public string Title { get; set; }
    public string Message { get; set; }
    public NotificationType Type { get; set; }
    public NotificationSeverity Severity { get; set; }
    public string SourceEntityType { get; set; }  // DataSource, Schema, InvalidRecord, etc.
    public string SourceEntityId { get; set; }
    public List<string> Recipients { get; set; }
    public Dictionary<string, object> Metadata { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public string ActionUrl { get; set; }
    public DateTime? ExpiresAt { get; set; }
}

public enum NotificationType
{
    ProcessingComplete,
    ProcessingFailed,
    ValidationError,
    SchemaUpdated,
    AlertTriggered,
    SystemInfo,
    UserAction
}

public enum NotificationSeverity
{
    Info,
    Success,
    Warning,
    Error,
    Critical
}
```

#### 7.1.2 Notification Rules

**File:** `src/Services/Shared/Entities/DataProcessingNotificationRule.cs`

```csharp
public class DataProcessingNotificationRule : DataProcessingBaseEntity
{
    public string Name { get; set; }
    public string Description { get; set; }
    public NotificationType TriggerType { get; set; }
    public List<RuleCondition> Conditions { get; set; }
    public List<string> Recipients { get; set; }
    public NotificationChannel Channel { get; set; }
    public bool IsActive { get; set; }
    public string MessageTemplate { get; set; }
}

public class RuleCondition
{
    public string Field { get; set; }
    public string Operator { get; set; }
    public object Value { get; set; }
}

public enum NotificationChannel
{
    InApp,
    Email,
    SMS,
    Webhook
}
```

#### 7.1.3 API Endpoints

```csharp
[HttpGet]
public async Task<IActionResult> GetNotifications(
    [FromQuery] string userId,
    [FromQuery] bool? isRead = null,
    [FromQuery] int page = 1,
    [FromQuery] int size = 25)

[HttpGet("{id}")]
public async Task<IActionResult> GetNotification(string id)

[HttpPut("{id}/read")]
public async Task<IActionResult> MarkAsRead(string id)

[HttpPut("bulk/read")]
public async Task<IActionResult> MarkMultipleAsRead(
    [FromBody] List<string> notificationIds)

[HttpDelete("{id}")]
public async Task<IActionResult> DeleteNotification(string id)

[HttpGet("unread-count")]
public async Task<IActionResult> GetUnreadCount([FromQuery] string userId)

// Notification Rules
[HttpGet("rules")]
public async Task<IActionResult> GetNotificationRules()

[HttpPost("rules")]
public async Task<IActionResult> CreateNotificationRule(
    [FromBody] CreateNotificationRuleRequest request)

[HttpPut("rules/{id}")]
public async Task<IActionResult> UpdateNotificationRule(
    string id,
    [FromBody] UpdateNotificationRuleRequest request)

[HttpDelete("rules/{id}")]
public async Task<IActionResult> DeleteNotificationRule(string id)
```

### 7.2 Frontend Notifications Management

#### 7.2.1 Notifications Page

**File:** `src/Frontend/src/pages/notifications/NotificationsManagement.tsx` (Complete Rewrite)

**Page Sections:**

1. **Notifications List**
   - Filter by type, severity, read/unread
   - Group by date
   - Mark as read/unread
   - Bulk actions
   - Action buttons to navigate to source entity

2. **Notification Detail Panel**
   - Full message
   - Metadata
   - Action buttons
   - Related entities

3. **Notification Rules Tab**
   - List of notification rules
   - Create/Edit rule form
   - Test rule button
   - Enable/Disable toggle

#### 7.2.2 Header Notification Bell

**File:** `src/Frontend/src/components/layout/AppHeader.tsx` (Enhance)

**Features:**
- Notification bell icon with unread count badge
- Dropdown with recent 5 notifications
- "Mark all as read" button
- "View all" link to notifications page
- Real-time updates via polling or WebSocket

---

## Implementation Priority and Phasing

### Sprint 1 (2 weeks): Data Sources Completion
- Complete DataSourceForm with all fields
- Add connection testing
- Implement schedule configuration
- Complete backend API endpoints
- Integration testing

### Sprint 2 (3 weeks): Schema Management Core
- Backend schema service and entities
- Schema list and basic CRUD operations
- Visual schema builder (basic)
- JSON editor with validation
- Schema templates

### Sprint 3 (2 weeks): Schema Management Advanced
- Regex helper dialog with common patterns
- Pattern tester and builder
- Field-specific configuration dialogs
- Schema documentation generator
- Hebrew localization completion

### Sprint 4 (2 weeks): Metrics Configuration
- Backend metrics service
- Metrics configuration wizard
- Real-time metric display
- Alert configuration
- Charts and visualizations

### Sprint 5 (2 weeks): Invalid Records Management
- Backend invalid records service enhancement
- Records table with filters
- Correction form
- Bulk operations
- Statistics dashboard

### Sprint 6 (1 week): Dashboard
- Backend dashboard endpoints
- Dashboard widgets
- Charts integration
- Auto-refresh functionality
- Quick actions

### Sprint 7 (2 weeks): AI Assistant Backend
- OpenAI service integration
- Chat conversation management
- Context-aware responses
- Quick actions implementation
- Hebrew/English dual language support

### Sprint 8 (2 weeks): Notifications System
- Backend notifications service
- Notification rules engine
- Frontend notifications page
- Header bell with real-time updates
- Email integration (optional)

---

## Technical Specifications

### Backend Technologies
- .NET 9.0 ASP.NET Core
- MongoDB.Entities 24.0.0 (Pure, no MongoDB.Driver)
- OpenAI .NET SDK 2.1.0
- MassTransit with Kafka
- Serilog for logging
- OpenTelemetry for monitoring
- xUnit for testing

### Frontend Technologies
- React 18
- TypeScript 5.x
- Ant Design 5.x with RTL support
- Recharts for data visualization
- Monaco Editor for code editing
- React Query for API state management
- i18next for localization

### JSON Schema Library
- Use Json.NET Schema or similar for 2020-12 support
- Implement custom validators for Hebrew-specific requirements

### Testing Strategy
- Backend: Integration tests for all API endpoints
- Frontend: Component tests with React Testing Library
- E2E tests for critical workflows
- Hebrew text encoding validation

---

## Hebrew Localization Requirements

### All Features Must Include:
1. Complete Hebrew translations in `src/Frontend/src/i18n/locales/he.json`
2. RTL layout support
3. Hebrew error messages from backend
4. Hebrew help documentation
5. Hebrew examples and placeholders
6. Right-to-left form layouts
7. Hebrew date/time formatting

### Translation Guidelines:
- Use professional, technical Hebrew terminology
- Consistent terminology across all features
- Include both Hebrew and English in critical UI elements
- Provide Hebrew tooltips and help text
- Document all Hebrew-specific patterns (phone, ID, etc.)

---

## API Documentation

### OpenAPI/Swagger Configuration
- All endpoints documented with XML comments
- Request/Response examples
- Error code documentation
- Hebrew descriptions alongside English
- Authentication/Authorization details

---

## Security Considerations

### Data Source Credentials
- Encrypt connection credentials at rest
- Use secure key management
- Never log sensitive information
- Implement credential rotation

### Schema Validation
- Prevent regex DOS attacks
- Limit schema complexity
- Validate JSON Schema syntax
- Sanitize user inputs

### AI Integration
- Rate limiting on OpenAI API calls
- Content filtering
- Cost monitoring
- Conversation data privacy

---

## Deployment and DevOps

### Docker Configuration
- Add new services to docker-compose.development.yml
- Create Dockerfiles for new services
- Configure health checks
- Set resource limits

### Kubernetes Configuration
- Create deployments for new services
- Update Helm charts
- Configure service mesh
- Set up horizontal pod autoscaling

### Monitoring
- Add Prometheus metrics for new services
- Configure Grafana dashboards
- Set up alerts
- Log aggregation

---

## Success Criteria

### Phase 1: Data Sources
- ✅ All form fields functional with validation
- ✅ Connection testing works for all types
- ✅ Schedule configuration saves correctly
- ✅ Hebrew error messages display properly

### Phase 2: Schema Management
- ✅ Visual builder creates valid JSON Schema 2020-12
- ✅ Regex helper with 8+ common Israeli patterns
- ✅ Pattern tester validates correctly
- ✅ Documentation generates in Hebrew
- ✅ Templates cover 5+ use cases

### Phase 3-7: Other Features
- ✅ All CRUD operations functional
- ✅ Hebrew localization complete
- ✅ Real-time updates working
- ✅ Integration tests passing
- ✅ Performance targets met

---

## Maintenance and Support

### Documentation Deliverables
1. API documentation (Swagger)
2. User guide in Hebrew
3. Developer guide for extending schemas
4. Deployment guide
5. Troubleshooting guide

### Training Materials
- Video tutorials in Hebrew
- Step-by-step guides
- Common patterns library
- FAQ section

---

## Appendix A: Common Israeli Data Patterns

### Israeli ID (Teudat Zehut)
- Pattern: `^[0-9]{9}$`
- Validation: Luhn algorithm check digit
- Example: 123456789

### Israeli Phone Numbers
- Mobile: `^05[0-9]{8}$`
- Landline: `^0[2-9][0-9]{7}$`
- Combined: `^0[2-9][0-9]{7,8}$`

### Israeli Business Number (Mispar Osek)
- Pattern: `^[0-9]{9}$`
- Example: 512345678

### Israeli Postal Code
- Pattern: `^[0-9]{5,7}$`
- Example: 12345 or 1234567

### Hebrew Text
- Pattern: `^[\u0590-\u05FF\s]+$`
- Range: U+0590 to U+05FF (Hebrew Unicode block)

---

## End of Document

**Total Estimated Effort:** 16 sprints (32 weeks)
**Team Size:** 3-4 developers (2 backend, 1-2 frontend)
**Review Cycles:** End of each sprint
**Go-Live:** After Sprint 8 (core features complete)
