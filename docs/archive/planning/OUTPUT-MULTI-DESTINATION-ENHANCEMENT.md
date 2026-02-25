# Multi-Destination Output Enhancement Specification

**Document Version:** 1.0  
**Date:** November 12, 2025  
**Status:** Planning - Ready for Implementation  
**Author:** System Architecture Team

---

## 📋 OVERVIEW

### Goal
Enhance OutputConfiguration to support multiple output destinations (Kafka topics, local folders, SFTP, HTTP APIs) per datasource with per-destination configuration and error isolation.

### Current Limitation
- ❌ Single Kafka topic per datasource
- ❌ Single local folder per datasource
- ❌ No flexibility for different formats per destination
- ❌ All-or-nothing error handling

### Proposed Enhancement
- ✅ Multiple Kafka topics (e.g., real-time + audit + analytics)
- ✅ Multiple local folders (e.g., archive + analytics team + compliance)
- ✅ Per-destination format control (Kafka gets JSON, folder gets CSV)
- ✅ Enable/disable destinations without deleting
- ✅ Isolated error handling (one destination failure doesn't block others)
- ✅ Future-ready: SFTP, HTTP API outputs

---

## 🏗️ ARCHITECTURE

### Entity Model

```csharp
namespace DataProcessing.Shared.Entities;

public class OutputConfiguration
{
    public List<OutputDestination> Destinations { get; set; } = new();
    public bool IncludeInvalidRecords { get; set; } = false;
    public string DefaultOutputFormat { get; set; } = "original";
}

public class OutputDestination
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = "kafka";
    public bool Enabled { get; set; } = true;
    public string? OutputFormat { get; set; }
    public bool? IncludeInvalidRecords { get; set; }
    
    public KafkaOutputConfig? KafkaConfig { get; set; }
    public FolderOutputConfig? FolderConfig { get; set; }
    public SftpOutputConfig? SftpConfig { get; set; }
    public HttpOutputConfig? HttpConfig { get; set; }
}

public class KafkaOutputConfig
{
    public string Topic { get; set; } = string.Empty;
    public string? MessageKey { get; set; }
    public Dictionary<string, string>? Headers { get; set; }
    public int? PartitionKey { get; set; }
}

public class FolderOutputConfig
{
    public string Path { get; set; } = string.Empty;
    public string? FileNamePattern { get; set; }
    public bool CreateSubfolders { get; set; } = false;
    public string? SubfolderPattern { get; set; }
    public bool OverwriteExisting { get; set; } = false;
}

public class SftpOutputConfig
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 22;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string RemotePath { get; set; } = string.Empty;
}

public class HttpOutputConfig
{
    public string Url { get; set; } = string.Empty;
    public string Method { get; set; } = "POST";
    public Dictionary<string, string>? Headers { get; set; }
    public string? AuthToken { get; set; }
}
```

---

## 🔧 BACKEND IMPLEMENTATION

### OutputService Handler Pattern

```csharp
public interface IOutputHandler
{
    bool CanHandle(string destinationType);
    Task<OutputResult> WriteAsync(
        OutputDestination destination, 
        string content, 
        string fileName,
        CancellationToken cancellationToken = default);
}

public class MultiDestinationOutputService
{
    private readonly IEnumerable<IOutputHandler> _handlers;
    
    public async Task ProcessOutputsAsync(
        DataProcessingDataSource dataSource,
        List<JsonDocument> validRecords,
        string fileName,
        Dictionary<string, object> formatMetadata)
    {
        var enabledDestinations = dataSource.Output.Destinations
            .Where(d => d.Enabled)
            .ToList();
        
        var results = new List<OutputResult>();
        
        foreach (var destination in enabledDestinations)
        {
            try
            {
                var format = destination.OutputFormat 
                    ?? dataSource.Output.DefaultOutputFormat;
                
                var content = await ReconstructAsync(validRecords, format, formatMetadata);
                
                var handler = _handlers.FirstOrDefault(h => h.CanHandle(destination.Type));
                var result = await handler.WriteAsync(destination, content, fileName);
                
                results.Add(result);
            }
            catch (Exception ex)
            {
                results.Add(OutputResult.Failure(destination.Name, ex.Message));
            }
        }
        
        return results;
    }
}
```

---

## 🎨 FRONTEND IMPLEMENTATION

### Component Structure

```
OutputTab.tsx (Main Container)
├── GlobalSettingsCard
├── DestinationsListCard
│   └── DestinationsTable
└── DestinationEditorModal
    ├── BasicInfoSection
    ├── TypeSpecificForm (dynamic)
    └── AdvancedSettingsSection
```

### UI Features
- Add/Edit/Delete destinations
- Enable/Disable toggle
- Drag-and-drop reordering
- Type-specific forms (Kafka vs Folder)
- Real-time validation
- Hebrew RTL support

---

## 📊 DEMO DATA EXAMPLES

### Example 1: Banking Transactions
```csharp
Output = new OutputConfiguration
{
    DefaultOutputFormat = "original",
    Destinations = new List<OutputDestination>
    {
        new() { Name = "Real-Time", Type = "kafka", 
                KafkaConfig = new() { Topic = "transactions-validated" } },
        new() { Name = "Archive", Type = "folder", 
                FolderConfig = new() { Path = @"C:\Archive\Banking" } },
        new() { Name = "Analytics", Type = "folder", OutputFormat = "csv",
                FolderConfig = new() { Path = @"C:\Analytics\Banking" } }
    }
}
```

---

## 🧪 TESTING STRATEGY

### Unit Tests (task-23)
- Multiple destinations processing
- Format override logic
- Error isolation

### Integration Tests (task-24)
- Write to 3 destinations simultaneously
- Partial failure scenarios
- Retry logic per destination

### E2E Tests (task-25)
- End-to-end with multiple outputs
- Verify all destinations receive data
- Verify correct formats per destination

---

## 📋 TASK UPDATES

### Tasks Affected:
- task-16: Enhanced entity model (+1 day)
- task-20: Multi-destination service (+2 days)
- task-22: DemoDataGenerator update (+1 day)
- task-23: Additional unit tests (+0.5 day)
- task-24: Multi-dest integration tests (+1 day)
- task-25: Multi-dest E2E tests (+0.5 day)
- task-27: Rich output UI (+2 days)

**Total Effort Increase:** ~8 days

---

## 🔗 REFERENCES

**Code Templates:**
- src/Services/Shared/Entities/OutputConfiguration.cs
- src/Services/OutputService/Handlers/
- src/Frontend/src/components/datasource/tabs/output/

**UI Mockup:**
- docs/mockups/output-multi-destination-mockup.html

**Implementation Tasks:**
- Task-16, Task-20, Task-22, Task-23, Task-24, Task-25, Task-27

---

**END OF SPECIFICATION**
