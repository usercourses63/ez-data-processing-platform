# InvalidRecordsService - Complete Implementation Guide

**MCP Task:** task-2 (req-1)  
**Priority:** P0 CRITICAL BLOCKER  
**Estimate:** 2 weeks (10 working days)  
**Port:** 5007  
**Status:** Ready to implement

---

## 📊 EXECUTIVE SUMMARY

### Why Critical

The **InvalidRecordsManagement** frontend page is 100% complete but shows hardcoded mockup data. Users can see a beautiful UI but cannot manage actual invalid records because the backend service doesn't exist.

**Current State:**
- Frontend UI: 100% ✅ (filters, search, correction, bulk ops, export)
- Entity Model: 100% ✅ (`DataProcessingInvalidRecord` in Shared)
- Backend Service: **0% ❌ (DOES NOT EXIST)**

---

## 🎯 REQUIREMENTS FROM FRONTEND

### Frontend Features That Need Backend Support

**From `InvalidRecordsManagement.tsx` Analysis:**

1. **List with Filters**
   - Pagination
   - Filter by data source
   - Filter by error type
   - Filter by date range
   - Search functionality

2. **Record Details**
   - Display validation errors
   - Show original data
   - Record metadata

3. **Actions**
   - Reprocess individual record
   - Delete record
   - Bulk reprocess
   - Bulk delete
   - Export to CSV

### Sample Mockup Data Structure

```typescript
interface InvalidRecord {
  id: string;
  recordId: string;
  dataSource: string;
  fileName: string;
  timestamp: string;
  errors: ValidationError[];
  originalData: any;
}

interface ValidationError {
  field: string;
  message: string;
  errorType: 'schema' | 'format' | 'required' | 'range';
}
```

---

## 🏗️ SERVICE ARCHITECTURE

### Project Structure

```
src/Services/InvalidRecordsService/
├── Controllers/
│   └── InvalidRecordController.cs      (15+ endpoints)
├── Services/
│   ├── IInvalidRecordService.cs
│   ├── InvalidRecordService.cs
│   ├── ICorrectionService.cs
│   └── CorrectionService.cs
├── Repositories/
│   ├── IInvalidRecordRepository.cs
│   └── InvalidRecordRepository.cs
├── Models/
│   ├── Requests/
│   │   ├── InvalidRecordListRequest.cs
│   │   ├── UpdateStatusRequest.cs
│   │   ├── CorrectRecordRequest.cs
│   │   ├── BulkOperationRequest.cs
│   │   └── ExportRequest.cs
│   └── Responses/
│       ├── InvalidRecordDto.cs
│       ├── InvalidRecordListResponse.cs
│       ├── StatisticsDto.cs
│       └── BulkOperationResult.cs
├── Properties/
│   └── launchSettings.json
├── Program.cs
├── appsettings.json
└── DataProcessing.InvalidRecords.csproj
```

---

## 📋 API ENDPOINTS SPECIFICATION

### 1. List & Query Endpoints

#### GET /api/v1/invalid-records
**Purpose:** Get paginated list with filters

**Query Parameters:**
```csharp
public class InvalidRecordListRequest
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 25;
    public string? DataSourceId { get; set; }
    public string? ErrorType { get; set; }  // schema, format, required, range
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public string? Search { get; set; }
    public string? Status { get; set; }  // New, InProgress, Corrected, Ignored
}
```

**Response:**
```csharp
public class InvalidRecordListResponse
{
    public List<InvalidRecordDto> Items { get; set; }
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
```

#### GET /api/v1/invalid-records/{id}
**Purpose:** Get single record details

**Response:**
```csharp
public class InvalidRecordDto
{
    public string Id { get; set; }
    public string DataSourceId { get; set; }
    public string DataSourceName { get; set; }
    public string FileName { get; set; }
    public int LineNumber { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<ValidationErrorDto> Errors { get; set; }
    public object OriginalData { get; set; }
    public object? CorrectedData { get; set; }
    public string Status { get; set; }
    public string? AssignedTo { get; set; }
}
```

#### GET /api/v1/invalid-records/statistics
**Purpose:** Get overall statistics

**Response:**
```csharp
public class StatisticsDto
{
    public int TotalInvalidRecords { get; set; }
    public int NewRecords { get; set; }
    public int InProgress { get; set; }
    public int Corrected { get; set; }
    public int Ignored { get; set; }
    public Dictionary<string, int> ByDataSource { get; set; }
    public Dictionary<string, int> ByErrorType { get; set; }
    public List<TrendDataPoint> Trend { get; set; }
}
```

#### GET /api/v1/invalid-records/datasource/{dataSourceId}
**Purpose:** Get records for specific data source  
**Response:** Same as list endpoint

### 2. Status Management Endpoints

#### PUT /api/v1/invalid-records/{id}/status
**Purpose:** Update record status

**Request:**
```csharp
public class UpdateStatusRequest
{
    public string Status { get; set; }  // New, InProgress, Corrected, Ignored
    public string? Notes { get; set; }
    public string UpdatedBy { get; set; }
}
```

#### PUT /api/v1/invalid-records/{id}/assign
**Purpose:** Assign record to user

**Request:**
```csharp
public class AssignRecordRequest
{
    public string AssignedTo { get; set; }
    public string AssignedBy { get; set; }
}
```

### 3. Correction Endpoints

#### PUT /api/v1/invalid-records/{id}/correct
**Purpose:** Correct invalid record data

**Request:**
```csharp
public class CorrectRecordRequest
{
    public object CorrectedData { get; set; }
    public string CorrectedBy { get; set; }
    public bool AutoReprocess { get; set; } = true;
}
```

**Response:**
```csharp
public class CorrectionResult
{
    public bool Success { get; set; }
    public string Message { get; set; }
    public string? ValidationResultId { get; set; }  // If reprocessed
}
```

#### POST /api/v1/invalid-records/{id}/reprocess
**Purpose:** Reprocess single record

**Response:**
```csharp
public class ReprocessResult
{
    public bool Success { get; set; }
    public bool IsValid { get; set; }
    public List<string>? ValidationErrors { get; set; }
    public string Message { get; set; }
}
```

### 4. Bulk Operations

#### POST /api/v1/invalid-records/bulk/reprocess
**Purpose:** Bulk reprocess records

**Request:**
```csharp
public class BulkOperationRequest
{
    public List<string> RecordIds { get; set; }
    public string RequestedBy { get; set; }
}
```

**Response:**
```csharp
public class BulkOperationResult
{
    public int TotalRequested { get; set; }
    public int Successful { get; set; }
    public int Failed { get; set; }
    public List<BulkOperationError> Errors { get; set; }
}
```

#### POST /api/v1/invalid-records/bulk/ignore
**Purpose:** Bulk mark as ignored

#### POST /api/v1/invalid-records/bulk/delete
**Purpose:** Bulk delete records

### 5. Export & Search

#### POST /api/v1/invalid-records/export
**Purpose:** Export to CSV

**Request:**
```csharp
public class ExportRequest
{
    public InvalidRecordListRequest Filters { get; set; }
    public string Format { get; set; } = "CSV";
}
```

**Response:** File download (text/csv)

#### POST /api/v1/invalid-records/search
**Purpose:** Advanced search with complex filters

---

## 🔧 DAY-BY-DAY IMPLEMENTATION PLAN

### Day 1: Project Setup & Infrastructure

**Tasks:**
1. Create new service project
2. Configure MongoDB connection
3. Setup MassTransit (in-memory bus)
4. Add health checks
5. Configure port 5007
6. Add to solution

**Commands:**
```bash
cd src/Services
dotnet new webapi -n InvalidRecordsService
cd InvalidRecordsService
dotnet add package MongoDB.Entities --version 24.x
dotnet add package MassTransit --version 8.x
dotnet add package Prometheus.Client --version 8.x
dotnet add reference ../Shared/DataProcessing.Shared.csproj

# Add to solution
cd ../..
dotnet sln add src/Services/InvalidRecordsService/InvalidRecordsService.csproj
```

**Files to Create:**
- `appsettings.json` (MongoDB, logging)
- `Properties/launchSettings.json` (port 5007)
- `Program.cs` (basic setup)

**Success Criteria:**
- ✅ Project compiles
- ✅ Service starts on port 5007
- ✅ MongoDB connects

### Days 2-3: Repository & Service Layer

**Tasks:**
1. Create `IInvalidRecordRepository.cs`
2. Implement `InvalidRecordRepository.cs`
3. Create `IInvalidRecordService.cs`
4. Implement `InvalidRecordService.cs`
5. Add DTOs and mappers

**Key Methods:**

**Repository:**
```csharp
Task<PagedResult<DataProcessingInvalidRecord>> GetPagedAsync(filters);
Task<DataProcessingInvalidRecord?> GetByIdAsync(string id);
Task<List<DataProcessingInvalidRecord>> GetByDataSourceAsync(string dsId);
Task<Statistics> GetStatisticsAsync();
Task UpdateStatusAsync(string id, status, notes, updatedBy);
Task DeleteAsync(string id);
Task<int> BulkDeleteAsync(List<string> ids);
```

**Service:**
```csharp
Task<InvalidRecordListResponse> GetListAsync(request);
Task<InvalidRecordDto?> GetByIdAsync(string id);
Task<StatisticsDto> GetStatisticsAsync();
Task UpdateStatusAsync(string id, request);
Task<BulkOperationResult> BulkDeleteAsync(request);
```

### Days 4-5: Controller & CRUD Endpoints

**Tasks:**
1. Create `InvalidRecordController.cs`
2. Implement list endpoint
3. Implement get by ID
4. Implement statistics
5. Implement filters
6. Add correlation ID tracking
7. Add logging

**Example Controller Method:**
```csharp
[HttpGet]
public async Task<IActionResult> GetInvalidRecords(
    [FromQuery] InvalidRecordListRequest request)
{
    var correlationId = HttpContext.GetCorrelationId();
    
    _logger.LogInformation(
        "GET /api/v1/invalid-records - Page: {Page}, Filters: {Filters}, CorrelationId: {CorrelationId}",
        request.Page, JsonSerializer.Serialize(request), correlationId);
    
    var result = await _service.GetListAsync(request);
    
    return Ok(new ApiResponse<InvalidRecordListResponse>
    {
        IsSuccess = true,
        Data = result
    });
}
```

**Test with Postman:**
- GET list endpoint
- Verify pagination
- Test filters
- Check response format

### Days 6-7: Correction Workflow

**Tasks:**
1. Create `ICorrectionService.cs`
2. Implement correction logic
3. Add reprocess integration
4. Implement correction endpoint
5. Implement reprocess endpoint
6. Test correction workflow

**CorrectionService Logic:**
```csharp
public async Task<CorrectionResult> CorrectRecordAsync(
    string recordId, 
    CorrectRecordRequest request)
{
    // 1. Get invalid record
    var record = await _repository.GetByIdAsync(recordId);
    
    // 2. Update with corrected data
    record.CorrectedData = request.CorrectedData;
    record.Status = RecordStatus.Corrected;
    record.UpdatedBy = request.CorrectedBy;
    await record.SaveAsync();
    
    // 3. If AutoReprocess, send to validation
    if (request.AutoReprocess)
    {
        await _validationClient.RevalidateAsync(
            record.DataSourceId,
            request.CorrectedData);
    }
    
    return new CorrectionResult { Success = true };
}
```

### Days 8-9: Bulk Operations

**Tasks:**
1. Implement bulk reprocess
2. Implement bulk ignore
3. Implement bulk delete
4. Add transaction support
5. Add progress tracking
6. Test with large datasets

**Bulk Operation Pattern:**
```csharp
public async Task<BulkOperationResult> BulkReprocessAsync(
    BulkOperationRequest request)
{
    var result = new BulkOperationResult
    {
        TotalRequested = request.RecordIds.Count
    };
    
    foreach (var recordId in request.RecordIds)
    {
        try
        {
            await ReprocessSingleAsync(recordId);
            result.Successful++;
        }
        catch (Exception ex)
        {
            result.Failed++;
            result.Errors.Add(new BulkOperationError
            {
                RecordId = recordId,
                Error = ex.Message
            });
        }
    }
    
    return result;
}
```

### Day 10: Export & Advanced Features

**Tasks:**
1. Implement CSV export
2. Add Excel export (optional)
3. Implement advanced search
4. Add data source name resolution
5. Optimize queries

**CSV Export Logic:**
```csharp
public async Task<byte[]> ExportToCsvAsync(ExportRequest request)
{
    var records = await GetRecordsForExport(request.Filters);
    
    var csv = new StringBuilder();
    csv.AppendLine("ID,DataSource,FileName,Timestamp,Errors,Status");
    
    foreach (var record in records)
    {
        csv.AppendLine($"{record.Id},{record.DataSourceName}," +
            $"{record.FileName},{record.CreatedAt}," +
            $"\"{string.Join("; ", record.Errors)}\",{record.Status}");
    }
    
    return Encoding.UTF8.GetBytes(csv.ToString());
}
```

### Days 11-12: Frontend Integration & Testing

**Tasks:**
1. Create `invalidrecords-api-client.ts`
2. Replace mockup data in frontend
3. Add error handling
4. Add loading states
5. Test all CRUD operations
6. Test bulk operations
7. Test export
8. Fix integration bugs

**API Client Template:**
```typescript
// src/Frontend/src/services/invalidrecords-api-client.ts
export class InvalidRecordsApiClient {
  private baseUrl = 'http://localhost:5007/api/v1/invalid-records';
  
  async getList(params: ListParams): Promise<ListResponse> {
    const response = await fetch(`${this.baseUrl}?${qs}`);
    return response.json();
  }
  
  async getById(id: string): Promise<InvalidRecord> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    return response.json();
  }
  
  async getStatistics(): Promise<Statistics> {
    const response = await fetch(`${this.baseUrl}/statistics`);
    return response.json();
  }
  
  // ... all other endpoints
}
```

**Frontend Changes:**
```typescript
// Replace mockup in InvalidRecordsManagement.tsx
// BEFORE
const invalidRecords: InvalidRecord[] = [/* hardcoded */];

// AFTER
const [records, setRecords] = useState<InvalidRecord[]>([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const fetchRecords = async () => {
    setLoading(true);
    const result = await apiClient.getList(filters);
    setRecords(result.items);
    setLoading(false);
  };
  fetchRecords();
}, [filters]);
```

---

## 📝 DETAILED ENDPOINT IMPLEMENTATIONS

### Endpoint 1: GET /api/v1/invalid-records

```csharp
[HttpGet]
[ProducesResponseType(typeof(ApiResponse<InvalidRecordListResponse>), 200)]
public async Task<IActionResult> GetInvalidRecords(
    [FromQuery] int page = 1,
    [FromQuery] int pageSize = 25,
    [FromQuery] string? dataSourceId = null,
    [FromQuery] string? errorType = null,
    [FromQuery] DateTime? startDate = null,
    [FromQuery] DateTime? endDate = null,
    [FromQuery] string? search = null,
    [FromQuery] string? status = null)
{
    var correlationId = HttpContext.GetCorrelationId();
    
    _logger.LogInformation(
        "GET /api/v1/invalid-records - Page: {Page}, Size: {PageSize}, " +
        "DataSource: {DataSourceId}, ErrorType: {ErrorType}, CorrelationId: {CorrelationId}",
        page, pageSize, dataSourceId, errorType, correlationId);
    
    try
    {
        var request = new InvalidRecordListRequest
        {
            Page = page,
            PageSize = pageSize,
            DataSourceId = dataSourceId,
            ErrorType = errorType,
            StartDate = startDate,
            EndDate = endDate,
            Search = search,
            Status = status
        };
        
        var result = await _invalidRecordService.GetListAsync(request);
        
        return Ok(new ApiResponse<InvalidRecordListResponse>
        {
            IsSuccess = true,
            Data = result
        });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to get invalid records list");
        return StatusCode(500, new ApiResponse<InvalidRecordListResponse>
        {
            IsSuccess = false,
            Error = new ErrorDetail
            {
                Message = "Failed to retrieve invalid records",
                MessageEnglish = "Failed to retrieve invalid records"
            }
        });
    }
}
```

### Service Implementation

```csharp
public async Task<InvalidRecordListResponse> GetListAsync(
    InvalidRecordListRequest request)
{
    // Build query
    var query = DB.Find<DataProcessingInvalidRecord>();
    
    // Apply filters
    if (!string.IsNullOrEmpty(request.DataSourceId))
        query = query.Match(r => r.DataSourceId == request.DataSourceId);
    
    if (!string.IsNullOrEmpty(request.ErrorType))
        query = query.Match(r => r.ErrorType == request.ErrorType);
    
    if (request.StartDate.HasValue)
        query = query.Match(r => r.CreatedAt >= request.StartDate.Value);
    
    if (request.EndDate.HasValue)
        query = query.Match(r => r.CreatedAt <= request.EndDate.Value);
    
    if (!string.IsNullOrEmpty(request.Status))
        query = query.Match(r => r.Status.ToString() == request.Status);
    
    if (!string.IsNullOrEmpty(request.Search))
    {
        query = query.Match(r => 
            r.FileName.Contains(request.Search) || 
            r.DataSourceId.Contains(request.Search));
    }
    
    // Get total count
    var totalCount = await query.CountAsync();
    
    // Apply pagination and sorting
    var records = await query
        .Sort(r => r.CreatedAt, Order.Descending)
        .Skip((request.Page - 1) * request.PageSize)
        .Limit(request.PageSize)
        .ExecuteAsync();
    
    // Map to DTOs (with data source names)
    var dtos = await MapToDtosAsync(records);
    
    return new InvalidRecordListResponse
    {
        Items = dtos,
        TotalCount = totalCount,
        Page = request.Page,
        PageSize = request.PageSize
    };
}

private async Task<List<InvalidRecordDto>> MapToDtosAsync(
    List<DataProcessingInvalidRecord> records)
{
    // Get unique data source IDs
    var dataSourceIds = records.Select(r => r.DataSourceId).Distinct();
    
    // Fetch data sources in batch
    var dataSources = await DB.Find<DataProcessingDataSource>()
        .Match(ds => dataSourceIds.Contains(ds.ID))
        .ExecuteAsync();
    
    var dataSourceMap = dataSources.ToDictionary(ds => ds.ID, ds => ds.Name);
    
    // Map to DTOs
    return records.Select(r => new InvalidRecordDto
    {
        Id = r.ID,
        DataSourceId = r.DataSourceId,
        DataSourceName = dataSourceMap.GetValueOrDefault(r.DataSourceId, "Unknown"),
        FileName = r.FileName,
        LineNumber = r.LineNumber,
        CreatedAt = r.CreatedAt,
        Errors = r.ValidationErrors.Select(e => new ValidationErrorDto
        {
            Field = ExtractField(e),
            Message = e,
            ErrorType = DetermineErrorType(e)
        }).ToList(),
        OriginalData = BsonSerializer.Deserialize<object>(r.OriginalRecord),
        CorrectedData = r.CorrectedData != null 
            ? BsonSerializer.Deserialize<object>(r.CorrectedData) 
            : null,
        Status = r.Status.ToString(),
        AssignedTo = r.AssignedTo
    }).ToList();
}
```

---

## 🧪 TESTING STRATEGY

### Unit Tests

```csharp
// InvalidRecordServiceTests.cs
[Fact]
public async Task GetListAsync_WithFilters_ReturnsFilteredResults()
{
    // Arrange
    var service = CreateService();
    var request = new InvalidRecordListRequest
    {
        DataSourceId = "ds001",
        ErrorType = "schema"
    };
    
    // Act
    var result = await service.GetListAsync(request);
    
    // Assert
    result.Items.Should().AllSatisfy(r => 
    {
        r.DataSourceId.Should().Be("ds001");
        r.Errors.Should().Contain(e => e.ErrorType == "schema");
    });
}
```

### Integration Tests

```csharp
// InvalidRecordControllerIntegrationTests.cs
[Fact]
public async Task GET_InvalidRecords_ReturnsPagedResults()
{
    // Arrange
    var client = _factory.CreateClient();
    
    // Act
    var response = await client.GetAsync(
        "/api/v1/invalid-records?page=1&pageSize=10");
    
    // Assert
    response.StatusCode.Should().Be(HttpStatusCode.OK);
    var result = await response.Content
        .ReadAsAsync<ApiResponse<InvalidRecordListResponse>>();
    result.IsSuccess.Should().BeTrue();
    result.Data.Items.Should().NotBeEmpty();
}
```

### E2E Tests

1. Create invalid record via ValidationService
2. Verify appears in InvalidRecordsService
3. Test correction workflow
4. Verify reprocess works
5. Test bulk operations
6. Verify statistics update

---

## 🔗 INTEGRATION POINTS

### 1. ValidationService Integration

**ValidationService stores invalid records:**
```csharp
// ValidationService/Services/ValidationService.cs (existing)
var invalidRecords = validationResults
    .Where(r => !r.IsValid)
    .Select(r => new DataProcessingInvalidRecord { ... })
    .ToList();

await invalidRecords.SaveAsync();  // Stored in MongoDB
```

**InvalidRecordsService reads them:**
```csharp
// Query same MongoDB collection
var records = await DB.Find<DataProcessingInvalidRecord>()
    .ExecuteAsync();
```

### 2. Frontend Integration

**Create API Client:**
```bash
# Create new file
src/Frontend/src/services/invalidrecords-api-client.ts
```

**Update Frontend Component:**
```typescript
// src/Frontend/src/pages/invalid-records/InvalidRecordsManagement.tsx

// Remove mockup data
// const invalidRecords: InvalidRecord[] = [/* hardcoded */];

// Add real API calls
import { invalidRecordsApiClient } from '../../services/invalidrecords-api-client';

const [records, setRecords] = useState<InvalidRecord[]>([]);
const [loading, setLoading] = useState(false);
const [statistics, setStatistics] = useState<Statistics | null>(null);

const fetchRecords = async () => {
  setLoading(true);
  try {
    const result = await invalidRecordsApiClient.getList({
      dataSource: selectedDataSource,
      errorType: selectedErrorType,
      page: currentPage,
      pageSize: 10
    });
    setRecords(result.items);
  } catch (error) {
    message.error('Failed to load invalid records');
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  fetchRecords();
  fetchStatistics();
}, [selectedDataSource, selectedErrorType, currentPage]);
```

---

## 🎯 SUCCESS CHECKLIST

**Service is Complete When:**

- [ ] Service project created and compiles
- [ ] Service runs on port 5007
- [ ] MongoDB connection working
- [ ] All 15+ endpoints implemented
- [ ] Repository pattern implemented
- [ ] Service layer with business logic
- [ ] DTOs and request/response models
- [ ] Correction workflow functional
- [ ] Bulk operations working
- [ ] Export to CSV working
- [ ] Statistics endpoint accurate
- [ ] API client created in frontend
- [ ] Frontend mockup data replaced
- [ ] All frontend features working with real data
- [ ] Unit tests written
- [ ] Integration tests passing
- [ ] E2E workflow tested
- [ ] Documentation updated
- [ ] Task-2 marked complete in MCP
- [ ] Task-2 approved by user

---

## 📦 DELIVERABLES

**Code:**
1. Complete InvalidRecordsService project
2. 15+ API endpoints
3. Repository and service layers
4. Request/response models
5. API client for frontend

**Documentation:**
1. API endpoint documentation
2. Integration guide
3. Testing documentation

**Tests:**
1. Unit tests (80%+ coverage)
2. Integration tests
3. E2E test scenarios

---

## 🚀 GETTING STARTED

**When Ready to Implement:**

1. **Start Fresh Session** (context reset)
2. **Review This Guide**
3. **Begin Day 1 Tasks**
4. **Use MCP Tracking:**
   ```
   mark_task_done when Day 1 complete
   Continue daily until all 12 days done
   approve_task_completion when tested
   ```

---

## 📊 ESTIMATED EFFORT

| Phase | Days | Effort |
|-------|------|--------|
| Setup | 1 | Low |
| Repository/Service | 2 | Medium |
| CRUD Endpoints | 2 | Medium |
| Correction Workflow | 2 | High |
| Bulk Operations | 2 | Medium |
| Export/Stats | 1 | Low |
| Integration/Testing | 2 | High |
| **Total** | **12 days** | **~80-100 hours** |

**Team Size:** 1 developer  
**Timeline:** 2-3 weeks (with testing & polish)

---

**Guide Status:** ✅ COMPLETE  
**Ready For:** Implementation in fresh session  
**MCP Task:** task-2 awaiting completion  
**Priority:** P0 CRITICAL - Start ASAP
