# File Processing Architecture Refactoring Plan

**Document Version:** 1.0  
**Date:** November 10, 2025  
**Status:** Planning Complete - Ready for Implementation  
**Author:** System Architecture Team

---

## 📋 EXECUTIVE SUMMARY

### Goal
Refactor FilesReceiverService into three scalable, stateless microservices with Hazelcast distributed caching for maximum throughput and performance.

### Key Changes
1. **Split** FilesReceiverService → FileDiscoveryService + FileProcessorService + OutputService
2. **Add** Hazelcast distributed cache for file content (unlimited file size support)
3. **Implement** data source connectors (Local, FTP, Kafka, HTTP, SFTP)
4. **Add** format converters and reconstructors (CSV↔JSON, XML↔JSON, Excel↔JSON)
5. **Enhance** ValidationService with business/data metrics calculation
6. **Update** ServiceOrchestrator and DemoDataGenerator for new services

### Expected Benefits
- **50x Throughput**: 10 files/sec → 500+ files/sec
- **Unlimited File Size**: Remove 4MB RabbitMQ limit via Hazelcast
- **Horizontal Scalability**: Independent scaling of discovery, processing, validation, output
- **Better Fault Isolation**: Failure in one file doesn't block others
- **Format Preservation**: Output in original format (not forced JSON)

---

## 🏗️ ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│ INFRASTRUCTURE LAYER                                        │
├─────────────────────────────────────────────────────────────┤
│ • Hazelcast Cluster (3 nodes × 8GB memory)                 │
│ • RabbitMQ (message broker)                                 │
│ • MongoDB (state storage)                                    │
│ • Prometheus + OTel Collector (metrics)                     │
│ • Kafka (output destination)                                │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ SERVICE LAYER                                               │
├─────────────────────────────────────────────────────────────┤
│ 1. SchedulingService (existing - no changes)               │
│ 2. FileDiscoveryService (NEW - file listing)              │
│ 3. FileProcessorService (NEW - read + convert + cache)    │
│ 4. ValidationService (enhanced - metrics calculation)      │
│ 5. OutputService (NEW - format reconstruction + output)    │
│ 6. InvalidRecordsService (existing - no changes)           │
│ 7. MetricsConfigurationService (existing - no changes)     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────────────┐
│ SUPPORT LAYER                                               │
├─────────────────────────────────────────────────────────────┤
│ • ServiceOrchestrator (updated for new services)           │
│ • DemoDataGenerator (updated - test file generation)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 PHASE 1: INFRASTRUCTURE SETUP

### 1.1 Hazelcast Cluster Deployment

**Location:** `deploy/kubernetes/hazelcast-cluster.yaml`

**Configuration:**
- 3-node StatefulSet for high availability
- 8GB memory per node (4GB JVM heap)
- Kubernetes service discovery
- TTL: 1 hour for cached content
- Health checks (readiness/liveness probes)

**Development:** Add to `docker-compose.development.yml`

```yaml
hazelcast:
  image: hazelcast/hazelcast:5.3
  container_name: hazelcast
  ports:
    - "5701:5701"
  environment:
    - JAVA_OPTS=-Xms2g -Xmx2g
```

### 1.2 Update docker-compose.development.yml

Add Hazelcast service alongside existing RabbitMQ, MongoDB, Prometheus, etc.

---

## 📦 PHASE 2: SHARED COMPONENTS

### 2.1 New Message Types

**Location:** `src/Services/Shared/Messages/`

**New Messages:**
1. `FileDiscoveredEvent.cs` - File metadata from discovery
2. Updated `ValidationRequestEvent.cs` - Add HazelcastKey, OriginalFormat, FormatMetadata
3. Updated `ValidationCompletedEvent.cs` - Add HazelcastKey for valid records

**Key Fields:**
- `HazelcastKey`: Cache reference (replaces inline content)
- `OriginalFormat`: "CSV", "XML", "JSON", "Excel"
- `FormatMetadata`: Dictionary for reconstruction (delimiters, headers, etc.)
- `SequenceNumber`: For ordering within poll batch
- `PollBatchId`: Correlation ID for grouping

### 2.2 Data Source Connectors

**Interface:** `src/Services/Shared/Connectors/IDataSourceConnector.cs`

**Implementations:**
1. `LocalFileConnector.cs` - File system and UNC paths
2. `FtpConnector.cs` - FTP/FTPS support (FluentFTP library)
3. `SftpConnector.cs` - SFTP support (SSH.NET library)
4. `KafkaConnector.cs` - Kafka topics as source
5. `HttpApiConnector.cs` - REST API file endpoints

**Methods:**
- `bool CanHandle(string connectionString)` - Check if connector supports datasource
- `Task<List<FileMetadata>> DiscoverFilesAsync()` - List available files
- `Task<string> ReadFileContentAsync()` - Read file content

### 2.3 Format Converters

**Interface:** `src/Services/Shared/Converters/IFormatConverter.cs`

**Implementations:**
1. `CsvToJsonConverter.cs` - CSV → JSON array
2. `XmlToJsonConverter.cs` - XML → JSON object
3. `ExcelToJsonConverter.cs` - Excel → JSON array
4. `JsonToJsonConverter.cs` - Passthrough

**Method:** `Task<ConversionResult> ConvertToJsonAsync()`

**ConversionResult:**
- `JsonContent` - Converted JSON string
- `OriginalFormat` - Source format
- `FormatMetadata` - Reconstruction hints

### 2.4 Format Reconstructors

**Interface:** `src/Services/Shared/Converters/IFormatReconstructor.cs`

**Implementations:**
1. `JsonToCsvReconstructor.cs` - JSON array → CSV
2. `JsonToXmlReconstructor.cs` - JSON → XML
3. `JsonToExcelReconstructor.cs` - JSON array → Excel
4. `JsonToJsonReconstructor.cs` - Passthrough

**Method:** `Task<string> ReconstructAsync(List<JsonDocument> validRecords, Dictionary<string, object> metadata)`

### 2.5 Entity Updates

**File:** `src/Services/Shared/Entities/DataProcessingDataSource.cs`

**New Fields:**
```csharp
// Data metrics configuration
public List<DataMetricDefinition> DataMetrics { get; set; } = new();

// Output configuration
public string? OutputKafkaTopic { get; set; }
public string? OutputLocalPath { get; set; }

public class DataMetricDefinition
{
    public string MetricName { get; set; }
    public string MetricType { get; set; } // SUM, AVG, COUNT, DISTINCT_COUNT, MIN, MAX
    public string FieldPath { get; set; } // JSON path: $.amount
    public string? FilterCondition { get; set; } // $.amount > 10000
    public Dictionary<string, string> Labels { get; set; } = new();
}
```

---

## 📦 PHASE 3: FILE DISCOVERY SERVICE

### 3.1 Project Setup

**Location:** `src/Services/FileDiscoveryService/`

**Structure:**
```
FileDiscoveryService/
├── FileDiscoveryService.csproj
├── Program.cs
├── appsettings.json
├── Properties/launchSettings.json
├── Consumers/FilePollingEventConsumer.cs
├── Services/IFileDiscoveryService.cs
├── Services/FileDiscoveryService.cs
└── README.md
```

### 3.2 Key Responsibilities

1. **Consume:** `FilePollingEvent` from SchedulingService
2. **Discover:** List files using appropriate connector
3. **Publish:** `FileDiscoveredEvent` for each file
4. **Track:** Prevent duplicate processing (MongoDB hash tracking)
5. **Metrics:** files_discovered, discovery_duration

### 3.3 Implementation Highlights

**Connector Selection:**
```csharp
var connector = _connectors.FirstOrDefault(c => c.CanHandle(dataSource.FilePath))
    ?? throw new NotSupportedException();
```

**Deduplication:**
```csharp
var fileHash = CalculateFileHash(fileInfo); // SHA256(path|size|modified)
if (dataSource.ProcessedFileHashes.Contains(fileHash))
    continue; // Skip already processed
```

**Sequencing:**
```csharp
for (int i = 0; i < files.Count; i++)
{
    await _publishEndpoint.Publish(new FileDiscoveredEvent
    {
        SequenceNumber = i, // For ordering
        PollBatchId = correlationId
        // ...
    });
}
```

### 3.4 Configuration

**appsettings.json:**
```json
{
  "ServiceName": "FileDiscoveryService",
  "MongoDB": {
    "ConnectionString": "mongodb://localhost:27017",
    "DatabaseName": "DataProcessing"
  },
  "RabbitMQ": {
    "Host": "localhost",
    "Username": "guest",
    "Password": "guest"
  },
  "OpenTelemetry": {
    "OtlpEndpoint": "http://otel-collector:4317"
  }
}
```

---

## 📦 PHASE 4: FILE PROCESSOR SERVICE

### 4.1 Project Setup

**Location:** `src/Services/FileProcessorService/`

**Structure:**
```
FileProcessorService/
├── FileProcessorService.csproj
├── Program.cs
├── appsettings.json
├── Properties/launchSettings.json
├── Consumers/FileDiscoveredEventConsumer.cs
├── Services/IFileProcessorService.cs
├── Services/FileProcessorService.cs
└── README.md
```

### 4.2 Key Responsibilities

1. **Consume:** `FileDiscoveredEvent` from FileDiscoveryService
2. **Read:** File content using connector
3. **Convert:** To JSON using format converter
4. **Cache:** Store in Hazelcast with TTL
5. **Publish:** `ValidationRequestEvent` with cache key
6. **Metrics:** files_processed, conversion_duration, hazelcast_put_duration

### 4.3 Hazelcast Integration

**NuGet:** `Hazelcast.Net` (v5.x)

**Configuration:**
```csharp
builder.Services.AddSingleton<IHazelcastClient>(sp =>
{
    var options = new HazelcastOptionsBuilder()
        .With(args =>
        {
            args.Networking.Addresses.Add("hazelcast:5701");
            args.ClusterName = "data-processing-cluster";
        })
        .Build();
    
    return await HazelcastClientFactory.StartNewClientAsync(options);
});
```

**Usage:**
```csharp
var fileCache = await _hazelcast.GetMapAsync<string, string>("file-content");
var cacheKey = $"file:{dataSourceId}:{Guid.NewGuid()}";
await fileCache.SetAsync(cacheKey, jsonContent, TimeSpan.FromHours(1));
```

### 4.4 Concurrency Configuration

**Program.cs:**
```csharp
x.AddConsumer<FileDiscoveredEventConsumer>(cfg =>
{
    cfg.UseConcurrentMessageLimit(10); // Process 10 files concurrently
});

x.UsingRabbitMq((context, cfg) =>
{
    cfg.PrefetchCount = 20; // Fetch ahead
    cfg.UseInMemoryOutbox(); // Prevent duplicate publishes
});
```

---

## 📦 PHASE 5: VALIDATION SERVICE ENHANCEMENTS

### 5.1 Existing Service Updates

**Location:** `src/Services/ValidationService/`

**Changes:**
1. Add Hazelcast client for content retrieval
2. Implement data metrics calculation
3. Store valid records in Hazelcast (not in message)
4. Cleanup original file content from cache

### 5.2 Data Metrics Calculation

**New Service:** `src/Services/ValidationService/Services/DataMetricsCalculator.cs`

**Responsibilities:**
- Extract field values using JSON path
- Evaluate filter conditions
- Calculate metrics per record type (SUM, AVG, COUNT, etc.)
- Publish to OpenTelemetry with labels

**Implementation:**
```csharp
foreach (var metricDef in dataSource.DataMetrics)
{
    var fieldValue = ExtractFieldValue(record, metricDef.FieldPath);
    
    var counter = GetOrCreateCounter(metricDef.MetricName);
    counter.Add(Convert.ToDouble(fieldValue), labels);
}
```

### 5.3 Updated Flow

```
1. Consume ValidationRequestEvent
2. Fetch content from Hazelcast using key
3. Validate each record against JSON schema
4. For VALID records:
   - Calculate data metrics
   - Store in list
5. Store valid records in Hazelcast
6. Store invalid records in MongoDB
7. Cleanup original content from cache
8. Publish ValidationCompletedEvent with valid records key
```

---

## 📦 PHASE 6: OUTPUT SERVICE

### 6.1 Project Setup

**Location:** `src/Services/OutputService/`

**Structure:**
```
OutputService/
├── OutputService.csproj
├── Program.cs
├── appsettings.json
├── Properties/launchSettings.json
├── Consumers/ValidationCompletedEventConsumer.cs
├── Services/IOutputService.cs
├── Services/OutputService.cs
└── README.md
```

### 6.2 Key Responsibilities

1. **Consume:** `ValidationCompletedEvent` from ValidationService
2. **Fetch:** Valid records from Hazelcast
3. **Reconstruct:** To original format (CSV, XML, Excel, JSON)
4. **Write:** To Kafka topic (if configured)
5. **Write:** To local folder (if configured)
6. **Cleanup:** Delete from Hazelcast
7. **Publish:** `FileProcessingCompletedEvent`
8. **Metrics:** records_output, reconstruction_duration, kafka_publish_duration

### 6.3 Output Destinations

**Kafka:**
```csharp
if (!string.IsNullOrEmpty(dataSource.OutputKafkaTopic))
{
    await _kafkaProducer.ProduceAsync(
        dataSource.OutputKafkaTopic,
        new Message<string, string>
        {
            Key = fileName,
            Value = reconstructedContent // CSV, XML, etc.
        });
}
```

**Local Folder:**
```csharp
if (!string.IsNullOrEmpty(dataSource.OutputLocalPath))
{
    var extension = GetExtension(originalFormat); // ".csv"
    var outputPath = Path.Combine(dataSource.OutputLocalPath, 
        $"{Path.GetFileNameWithoutExtension(fileName)}_valid{extension}");
    
    await File.WriteAllTextAsync(outputPath, reconstructedContent);
}
```

---

## 📦 PHASE 7: SERVICE ORCHESTRATOR UPDATES

### 7.1 File Location

**Update:** `tools/ServiceOrchestrator/Services/OrchestratorServices.cs`

### 7.2 Changes Required

**Add New Services:**
```csharp
private static readonly List<ServiceInfo> _services = new()
{
    // Existing services...
    new ServiceInfo
    {
        Name = "FileDiscoveryService",
        ProjectPath = "src/Services/FileDiscoveryService/FileDiscoveryService.csproj",
        Port = 5020,
        DependsOn = new[] { "RabbitMQ", "MongoDB", "Hazelcast" }
    },
    new ServiceInfo
    {
        Name = "FileProcessorService",
        ProjectPath = "src/Services/FileProcessorService/FileProcessorService.csproj",
        Port = 5021,
        DependsOn = new[] { "RabbitMQ", "MongoDB", "Hazelcast" }
    },
    new ServiceInfo
    {
        Name = "OutputService",
        ProjectPath = "src/Services/OutputService/OutputService.csproj",
        Port = 5022,
        DependsOn = new[] { "RabbitMQ", "MongoDB", "Hazelcast", "Kafka" }
    }
};
```

**Remove:**
- FilesReceiverService (replaced by 3 new services)

**Start Order:**
1. Infrastructure (RabbitMQ, MongoDB, Hazelcast, Kafka, Prometheus, OTel)
2. Core Services (DataSourceManagementService, SchedulingService)
3. File Processing Pipeline (FileDiscoveryService, FileProcessorService, ValidationService, OutputService)
4. Support Services (InvalidRecordsService, MetricsConfigurationService, etc.)

---

## 📦 PHASE 8: DEMO DATA GENERATOR UPDATES

### 8.1 File Location

**Update:** `tools/DemoDataGenerator/`

### 8.2 New Generator

**File:** `tools/DemoDataGenerator/Generators/TestFileGenerator.cs`

**Responsibilities:**
- Generate test CSV files based on existing datasources/schemas
- Generate test XML files
- Generate test JSON files
- Place in datasource FilePath locations
- Use coherent data from DemoDataGenerator's existing entities

**Example:**
```csharp
public class TestFileGenerator
{
    public async Task GenerateTestFilesAsync()
    {
        var dataSources = await DB.Find<DataProcessingDataSource>()
            .ExecuteAsync();
        
        foreach (var ds in dataSources)
        {
            if (ds.FileType == "CSV")
            {
                await GenerateCsvFileAsync(ds);
            }
            else if (ds.FileType == "XML")
            {
                await GenerateXmlFileAsync(ds);
            }
            // ...
        }
    }
    
    private async Task GenerateCsvFileAsync(DataProcessingDataSource ds)
    {
        // Get schema fields
        var schema = await DB.Find<DataProcessingSchema>()
            .Match(s => s.ID == ds.SchemaId)
            .ExecuteFirstAsync();
        
        // Generate CSV rows based on schema
        var csvContent = new StringBuilder();
        csvContent.AppendLine(string.Join(",", GetHeadersFromSchema(schema)));
        
        for (int i = 0; i < 100; i++) // 100 test records
        {
            csvContent.AppendLine(GenerateRowFromSchema(schema));
        }
        
        // Write to datasource path
        var fileName = $"test-data-{DateTime.UtcNow:yyyyMMddHHmmss}.csv";
        await File.WriteAllTextAsync(Path.Combine(ds.FilePath, fileName), csvContent.ToString());
    }
}
```

---

## 📦 PHASE 9: TESTING STRATEGY

### 9.1 Unit Tests

**Location:** `tests/Unit/`

**Coverage:**
- Connector implementations (all 5 connectors)
- Format converters (CSV, XML, Excel → JSON)
- Format reconstructors (JSON → CSV, XML, Excel)
- Data metrics calculator
- Hazelcast integration

### 9.2 Integration Tests

**Location:** `tests/Integration/`

**Scenarios:**
1. **End-to-End Flow:** Schedule → Discovery → Processing → Validation → Output
2. **Hazelcast Cache:** Write/Read/Delete operations
3. **Format Round-Trip:** CSV → JSON → Validate → CSV (verify identical)
4. **Data Metrics:** Verify metrics published to Prometheus
5. **Error Handling:** File read errors, invalid formats, cache failures

### 9.3 E2E Test with DemoDataGenerator

**Test Plan:**
```
1. Run DemoDataGenerator to seed database
2. Generate test files using TestFileGenerator
3. Start all services via ServiceOrchestrator
4. Trigger scheduling poll
5. Verify:
   - Files discovered
   - Content cached in Hazelcast
   - Validation completed
   - Valid records output to Kafka/folder
   - Invalid records stored in MongoDB
   - Metrics published to Prometheus
6. Verify format preservation (input CSV → output CSV)
```

**Test Script:** `tests/e2e-file-processing-test.ps1`

---

## 📦 PHASE 10: FRONTEND UPDATES

### 10.1 DataSource Form Enhancements

**Location:** `src/Frontend/src/pages/datasources/DataSourceFormEnhanced.tsx`

**New Sections:**

**1. Data Metrics Configuration:**
```typescript
<Card title="Data Metrics">
  <Button onClick={addMetric}>+ Add Data Metric</Button>
  {dataMetrics.map(metric => (
    <MetricEditor
      metric={metric}
      schema={selectedSchema}
      onChange={updateMetric}
    />
  ))}
</Card>
```

**2. Output Configuration:**
```typescript
<Card title="Output Destinations">
  <Input
    label="Kafka Topic"
    value={outputKafkaTopic}
    placeholder="e.g., validated-records"
  />
  <Input
    label="Local Folder Path"
    value={outputLocalPath}
    placeholder="e.g., /output/validated"
  />
</Card>
```

### 10.2 New Components

**File:** `src/Frontend/src/components/datasource/DataMetricEditor.tsx`

**Features:**
- Metric name input
- Aggregation type selector (SUM, AVG, COUNT, etc.)
- JSON path selector (tree view from schema)
- Filter condition builder
- Label configuration (key-value pairs with JSON path)

---

## 📦 PHASE 11: DEPLOYMENT

### 11.1 Kubernetes Deployments

**Files to Create:**
1. `deploy/kubernetes/hazelcast-cluster.yaml` (done in Phase 1)
2. `deploy/kubernetes/filediscovery-deployment.yaml`
3. `deploy/kubernetes/fileprocessor-deployment.yaml`
4. `deploy/kubernetes/output-deployment.yaml`

**Scaling Configuration:**
- FileDiscoveryService: 2 replicas (lightweight)
- FileProcessorService: 5 replicas (CPU-intensive)
- OutputService: 3 replicas (I/O-intensive)

### 11.2 Helm Chart Updates

**Location:** `deploy/helm/dataprocessing-service/`

**Update `values.yaml`:**
```yaml
services:
  fileDiscovery:
    replicas: 2
    resources:
      requests:
        memory: 512Mi
        cpu: 500m
  fileProcessor:
    replicas: 5
    resources:
      requests:
        memory: 1Gi
        cpu: 1000m
  output:
    replicas: 3
    resources:
      requests:
        memory: 512Mi
        cpu: 500m

hazelcast:
  enabled: true
  replicas: 3
  memory: 8Gi
```

---

## 📊 IMPLEMENTATION TIMELINE

### Week 1: Infrastructure & Shared Components
- Day 1-2: Hazelcast deployment (Kubernetes + Docker Compose)
- Day 3-4: Message types, connectors, converters
- Day 5: Entity updates, ServiceOrchestrator updates

### Week 2: Core Services
- Day 1-2: FileDiscoveryService
- Day 3-4: FileProcessorService
- Day 5: ValidationService enhancements

### Week 3: Output & Testing
- Day 1-2: OutputService
- Day 3-4: DemoDataGenerator updates, test file generation
- Day 5: Unit tests

### Week 4: Integration & E2E
- Day 1-2: Integration tests
- Day 3-4: E2E tests, bug fixes
- Day 5: Frontend updates

### Week 5: Deployment & Documentation
- Day 1-2: Kubernetes deployments
- Day 3-4: Performance testing, optimization
- Day 5: Documentation, handoff

---

## 📈 SUCCESS METRICS

### Performance Targets
- **Throughput:** 500+ files/second (50x improvement)
- **Latency:** <500ms per file (end-to-end)
- **File Size:** Unlimited (tested up to 100MB)
- **Concurrency:** 50+ files processing simultaneously

### Quality Targets
- **Unit Test Coverage:** >80%
- **Integration Test Coverage:** All happy paths + error cases
- **Uptime:** 99.9% (each service independently)
- **Data Accuracy:** 100% (format round-trip verification)

### Operational Targets
- **Horizontal Scaling:** Linear throughput increase with replicas
- **Resource Efficiency:** <2GB memory per service instance
- **Cache Hit Rate:** >90% (Hazelcast)
- **Message Broker Load:** <10% of previous (lightweight messages)

---

## ⚠️ MIGRATION STRATEGY

### Parallel Deployment (Recommended)

**Phase 1: Deploy New Services**
- Deploy Hazelcast cluster
- Deploy FileDiscoveryService, FileProcessorService, OutputService
- Configure SchedulingService to publish to both old and new pipelines

**Phase 2: Validation**
- Run both pipelines in parallel for 1 week
- Compare outputs (should be identical)
- Monitor metrics and performance

**Phase 3: Cutover**
- Disable FilesReceiverService
- Route all traffic through new pipeline
- Monitor for 48 hours

**Phase 4: Decommission**
- Remove FilesReceiverService from orchestrator
- Delete old code and deployments

### Rollback Plan
- Keep FilesReceiverService deployed but idle
- If issues detected, reconfigure SchedulingService to use old pipeline
- Fix issues in new pipeline
- Retry cutover

---

## 📚 DEPENDENCIES

### NuGet Packages (New)
- `Hazelcast.Net` (v5.x) - Distributed cache client
- `FluentFTP` (v49.x) - FTP connector
- `SSH.NET` (v2023.x) - SFTP connector
- `Confluent.Kafka` (v2.x) - Kafka output
- `CsvHelper` (v30.x) - CSV processing
- `ClosedXML` (v0.102.x) - Excel processing
- `Newtonsoft.Json.Schema` (v3.x) - JSON path evaluation

### Infrastructure
- Hazelcast 5.3+ (distributed cache)
- Kafka 3.x+ (output destination)
- RabbitMQ 3.12+ (existing)
- MongoDB 6.0+ (existing)
- Prometheus 2.x+ (existing)
- OpenTelemetry Collector 0.88+ (existing)

---

## 🎯 DECISION LOG

### Why Hazelcast from Start?
- **Rationale:** Adding later requires second migration; cost of upfront implementation is lower
- **Trade-off:** Additional infrastructure complexity
- **Conclusion:** Benefits outweigh costs for production workloads

### Why Separate Services (Discovery/Processing/Output)?
- **Rationale:** Each has different scaling characteristics and responsibilities
- **Alternative:** Single service with internal parallelization
- **Conclusion:** Microservices pattern enables independent scaling and fault isolation

### Why Format Preservation?
- **Rationale:** Users expect output in same format as input
- **Alternative:** Force JSON output
- **Conclusion:** User experience and downstream compatibility justify complexity

### Why ValidationService Calculates Data Metrics?
- **Rationale:** Already processing every record; has access to validated data
- **Alternative:** Separate MetricsCalculationService
- **Conclusion:** Avoid extra service and message passing overhead

---

## 📞 SUPPORT & CONTACTS

**Architecture Questions:** System Architecture Team  
**Implementation Support:** Development Team  
**Infrastructure Setup:** DevOps Team  
**Testing Strategy:** QA Team

---

## 📝 APPENDICES

### Appendix A: Complete File Listing
See implementation tasks in task manager for detailed file-by-file breakdown.

### Appendix B: Configuration Examples
Full configuration files available in `deploy/` directory after implementation.

### Appendix C: Troubleshooting Guide
To be created during implementation based on encountered issues.

---

**END OF DOCUMENT**
