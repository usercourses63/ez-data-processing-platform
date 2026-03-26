using DataProcessing.Shared.Entities;
using InvalidRecordsService.Models.Requests;
using InvalidRecordsService.Models.Responses;
using InvalidRecordsService.Repositories;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Entities;

namespace InvalidRecordsService.Services;

public class InvalidRecordService : IInvalidRecordService
{
    private readonly IInvalidRecordRepository _repository;
    private readonly ILogger<InvalidRecordService> _logger;

    public InvalidRecordService(
        IInvalidRecordRepository repository,
        ILogger<InvalidRecordService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task<InvalidRecordListResponse> GetListAsync(InvalidRecordListRequest request)
    {
        var (records, totalCount) = await _repository.GetPagedAsync(request);
        
        // Map to DTOs with data source names
        var dtos = await MapToDtosAsync(records);

        return new InvalidRecordListResponse
        {
            Items = dtos,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize
        };
    }

    public async Task<InvalidRecordDto?> GetByIdAsync(string id)
    {
        var record = await _repository.GetByIdAsync(id);
        if (record == null)
        {
            return null;
        }

        var dtos = await MapToDtosAsync(new List<DataProcessingInvalidRecord> { record });
        return dtos.FirstOrDefault();
    }

    public async Task<StatisticsDto> GetStatisticsAsync()
    {
        return await _repository.GetStatisticsAsync();
    }

    public async Task UpdateStatusAsync(string id, UpdateStatusRequest request)
    {
        var ignore = request.Status.Equals("ignored", StringComparison.OrdinalIgnoreCase);
        await _repository.UpdateStatusAsync(id, request.UpdatedBy, request.Notes, ignore);
        
        _logger.LogInformation("Updated status for invalid record {RecordId} to {Status} by {User}",
            id, request.Status, request.UpdatedBy);
    }

    public async Task<BulkOperationResult> BulkDeleteAsync(BulkOperationRequest request)
    {
        var result = new BulkOperationResult
        {
            TotalRequested = request.RecordIds.Count
        };

        foreach (var recordId in request.RecordIds)
        {
            try
            {
                await _repository.DeleteAsync(recordId);
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
                
                _logger.LogWarning(ex, "Failed to delete invalid record {RecordId}", recordId);
            }
        }

        _logger.LogInformation("Bulk delete completed: {Successful}/{Total} successful, RequestedBy: {User}",
            result.Successful, result.TotalRequested, request.RequestedBy);

        return result;
    }

    /// <summary>
    /// Maps entity models to DTOs with data source name resolution
    /// </summary>
    private async Task<List<InvalidRecordDto>> MapToDtosAsync(List<DataProcessingInvalidRecord> records)
    {
        if (!records.Any())
        {
            return new List<InvalidRecordDto>();
        }

        // Get unique data source IDs
        var dataSourceIds = records.Select(r => r.DataSourceId).Distinct().ToList();

        // Batch fetch data sources for efficiency
        var dataSources = await DB.Find<DataProcessingDataSource>()
            .Match(ds => dataSourceIds.Contains(ds.ID))
            .ExecuteAsync();

        var dataSourceMap = dataSources.ToDictionary(ds => ds.ID, ds => ds.Name);

        // Map records to DTOs
        return records.Select(r => MapToDto(r, dataSourceMap)).ToList();
    }

    /// <summary>
    /// Maps a single entity to DTO
    /// </summary>
    private InvalidRecordDto MapToDto(
        DataProcessingInvalidRecord record,
        Dictionary<string, string> dataSourceMap)
    {
        return new InvalidRecordDto
        {
            Id = record.ID,
            DataSourceId = record.DataSourceId,
            DataSourceName = dataSourceMap.GetValueOrDefault(record.DataSourceId, "Unknown"),
            FileName = record.FileName,
            LineNumber = record.LineNumber,
            CreatedAt = record.CreatedAt,
            Errors = MapValidationErrors(record),
            OriginalData = BsonDocumentToObject(record.OriginalRecord),
            ErrorType = record.ErrorType,
            Severity = record.Severity,
            IsReviewed = record.IsReviewed,
            ReviewedBy = record.ReviewedBy,
            ReviewedAt = record.ReviewedAt,
            ReviewNotes = record.ReviewNotes,
            IsIgnored = record.IsIgnored
        };
    }

    /// <summary>
    /// Maps validation errors to DTOs
    /// </summary>
    private List<ValidationErrorDto> MapValidationErrors(DataProcessingInvalidRecord record)
    {
        return record.ValidationErrors.Select(error => new ValidationErrorDto
        {
            Field = ExtractFieldNameFromError(error),
            Message = error,
            ErrorType = record.ErrorType,
            ExpectedValue = ExtractExpectedValueFromError(error),
            ActualValue = ExtractActualValueFromError(error, record.OriginalRecord)
        }).ToList();
    }

    /// <summary>
    /// Extracts expected value from Corvus JSON Schema validation error message.
    /// Patterns:
    /// - Maximum: "2000000 is greater than 1000000" → expected: "1000000"
    /// - Minimum: "5 is less than 10" → expected: "10"
    /// - Format: "should have been'date' but was ''" → expected: "date"
    /// - Pattern: "TXN-ABCD1234 did not match '^TXN-\\d{8}$'" → expected: "^TXN-\\d{8}$"
    /// - Enum: "did not validate against the enumeration" → expected: "valid enum value"
    /// </summary>
    private static string? ExtractExpectedValueFromError(string errorMessage)
    {
        if (string.IsNullOrEmpty(errorMessage))
        {
            return null;
        }

        // Pattern: Maximum validation - "X is greater than Y" → expected = Y
        var maxMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"(\d+(?:\.\d+)?)\s+is\s+greater\s+than\s+(\d+(?:\.\d+)?)");
        if (maxMatch.Success)
        {
            return maxMatch.Groups[2].Value;  // The maximum allowed value
        }

        // Pattern: Minimum validation - "X is less than Y" → expected = Y
        var minMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"(\d+(?:\.\d+)?)\s+is\s+less\s+than\s+(\d+(?:\.\d+)?)");
        if (minMatch.Success)
        {
            return minMatch.Groups[2].Value;  // The minimum required value
        }

        // Pattern: Format validation - "should have been'format' but was 'value'" → expected = format
        var formatMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"should\s+have\s+been\s*'([^']+)'");
        if (formatMatch.Success)
        {
            return formatMatch.Groups[1].Value;  // The expected format
        }

        // Pattern: Pattern validation - "value did not match 'pattern'" → expected = pattern
        var patternMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"did\s+not\s+match\s+'([^']+)'");
        if (patternMatch.Success)
        {
            return patternMatch.Groups[1].Value;  // The expected pattern
        }

        // Pattern: Enum validation - "did not validate against the enumeration"
        if (errorMessage.Contains("enumeration"))
        {
            return "valid enum value";
        }

        // Pattern: Required property - "the required property 'X' was not present"
        if (errorMessage.Contains("required property"))
        {
            return "required";
        }

        return null;
    }

    /// <summary>
    /// Extracts actual value from Corvus JSON Schema validation error message.
    /// Patterns:
    /// - Maximum: "2000000 is greater than 1000000" → actual: "2000000"
    /// - Minimum: "5 is less than 10" → actual: "5"
    /// - Format: "should have been'date' but was 'not-a-date'" → actual: "not-a-date"
    /// - Pattern: "TXN-ABCD1234 did not match..." → actual: "TXN-ABCD1234"
    /// - Enum: look in originalData for the field value
    /// </summary>
    private static string? ExtractActualValueFromError(string errorMessage, BsonDocument? originalRecord)
    {
        if (string.IsNullOrEmpty(errorMessage))
        {
            return null;
        }

        // IMPORTANT: minLength/maxLength must be checked BEFORE numeric min/max
        // to avoid the numeric regex matching "X of 1 is less than 2"
        // Pattern: minLength/maxLength validation - extract value from error message
        // Format: "minLength - VALUE of LENGTH is less than MIN" or "maxLength - VALUE of LENGTH is greater than MAX"
        if (errorMessage.Contains("minLength") || errorMessage.Contains("maxLength"))
        {
            // Extract actual value from error message pattern: "minLength - VALUE of LENGTH"
            var lengthMatch = System.Text.RegularExpressions.Regex.Match(
                errorMessage,
                @"(?:minLength|maxLength)\s+-\s+(.+?)\s+of\s+\d+\s+is\s+(?:less|greater)\s+than");
            if (lengthMatch.Success)
            {
                var value = lengthMatch.Groups[1].Value.Trim();
                return string.IsNullOrEmpty(value) ? "(empty)" : value;
            }

            // Fallback: try to get from original record
            if (originalRecord != null)
            {
                var fieldName = ExtractFieldNameFromError(errorMessage);
                if (fieldName != "Unknown" && originalRecord.TryGetElement(fieldName, out var element))
                {
                    var value = element.Value?.ToString();
                    return string.IsNullOrEmpty(value) ? "(empty)" : value;
                }
            }
        }

        // Pattern: Maximum validation - "X is greater than Y" → actual = X
        var maxMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"(\d+(?:\.\d+)?)\s+is\s+greater\s+than\s+(\d+(?:\.\d+)?)");
        if (maxMatch.Success)
        {
            return maxMatch.Groups[1].Value;  // The actual value that exceeded max
        }

        // Pattern: Minimum validation - "X is less than Y" → actual = X
        var minMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"(\d+(?:\.\d+)?)\s+is\s+less\s+than\s+(\d+(?:\.\d+)?)");
        if (minMatch.Success)
        {
            return minMatch.Groups[1].Value;  // The actual value below minimum
        }

        // Pattern: Format validation - "should have been'format' but was 'value'" → actual = value
        var formatMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"but\s+was\s+'([^']*)'");
        if (formatMatch.Success)
        {
            var actualValue = formatMatch.Groups[1].Value;
            return string.IsNullOrEmpty(actualValue) ? "(empty)" : actualValue;
        }

        // Pattern: Pattern validation - "value did not match 'pattern'" → actual = value
        // Check for empty pattern value first (double space before "did not match")
        if (errorMessage.Contains("Invalid Validation pattern -  did not match"))
        {
            return "(empty)";  // Empty value for pattern validation
        }

        var patternMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"^\#/\w+\s+Invalid Validation pattern\s+-\s+(\S+)\s+did\s+not\s+match");
        if (patternMatch.Success)
        {
            return patternMatch.Groups[1].Value;  // The actual value that didn't match
        }

        // Pattern: Enum validation - extract field and get value from original data
        if (errorMessage.Contains("enumeration") && originalRecord != null)
        {
            var fieldName = ExtractFieldNameFromError(errorMessage);
            if (fieldName != "Unknown" && originalRecord.Contains(fieldName))
            {
                return originalRecord[fieldName]?.ToString();
            }
        }

        // Pattern: Required property - value is missing
        if (errorMessage.Contains("required property"))
        {
            return "(missing)";
        }

        return null;
    }

    /// <summary>
    /// Extracts field name from Corvus JSON Schema validation error message.
    /// Error formats:
    /// - "#/TransactionId Invalid Validation pattern..." → "TransactionId"
    /// - "#/Status Invalid Validation enum..." → "Status"
    /// - "# Invalid Validation properties - the required property 'Date' was not present." → "Date"
    /// </summary>
    private static string ExtractFieldNameFromError(string errorMessage)
    {
        if (string.IsNullOrEmpty(errorMessage))
        {
            return "Unknown";
        }

        // Pattern 1: "#/FieldName Invalid..." - field name is after #/ and before space
        if (errorMessage.StartsWith("#/"))
        {
            var endIndex = errorMessage.IndexOf(' ', 2);
            if (endIndex > 2)
            {
                return errorMessage.Substring(2, endIndex - 2);
            }
        }

        // Pattern 2: "the required property 'FieldName' was not present"
        var requiredMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"the required property '([^']+)' was not present");
        if (requiredMatch.Success)
        {
            return requiredMatch.Groups[1].Value;
        }

        // Pattern 3: Check for common field references in the message
        var fieldMatch = System.Text.RegularExpressions.Regex.Match(
            errorMessage,
            @"'([A-Z][a-zA-Z0-9_]*)'");
        if (fieldMatch.Success)
        {
            return fieldMatch.Groups[1].Value;
        }

        return "Unknown";
    }

    /// <summary>
    /// Converts BsonDocument to object for JSON serialization
    /// </summary>
    private object? BsonDocumentToObject(BsonDocument? bsonDoc)
    {
        if (bsonDoc == null)
        {
            return null;
        }

        try
        {
            var json = bsonDoc.ToJson();
            return BsonSerializer.Deserialize<object>(bsonDoc);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to deserialize BsonDocument");
            return new { error = "Failed to parse original data" };
        }
    }

    public async Task<int> GetRevalidatableCountAsync(string? dataSourceId)
    {
        return await _repository.GetActiveCountAsync(dataSourceId);
    }

    /// <summary>
    /// Export invalid records to CSV format
    /// </summary>
    public async Task<byte[]> ExportToCsvAsync(ExportRequest request)
    {
        _logger.LogInformation("Exporting invalid records to CSV with filters");

        // Get filtered records (without pagination for export)
        var exportFilters = request.Filters;
        exportFilters.Page = 1;
        exportFilters.PageSize = int.MaxValue;  // Get all matching records

        var (records, _) = await _repository.GetPagedAsync(exportFilters);
        var dtos = await MapToDtosAsync(records);

        // Build CSV
        var csv = new System.Text.StringBuilder();
        
        // Header
        csv.AppendLine("ID,DataSource,FileName,LineNumber,CreatedAt,ErrorType,Severity,Errors,IsReviewed,ReviewedBy,IsIgnored");

        // Data rows
        foreach (var record in dtos)
        {
            var errorsText = string.Join("; ", record.Errors.Select(e => $"{e.Field}: {e.Message}"));
            errorsText = errorsText.Replace("\"", "\"\"");  // Escape quotes for CSV

            csv.AppendLine($"\"{record.Id}\",\"{record.DataSourceName}\",\"{record.FileName}\"," +
                $"{record.LineNumber ?? 0},\"{record.CreatedAt:yyyy-MM-dd HH:mm:ss}\"," +
                $"\"{record.ErrorType}\",\"{record.Severity}\"," +
                $"\"{errorsText}\"," +
                $"{record.IsReviewed},\"{record.ReviewedBy ?? ""}\",{record.IsIgnored}");
        }

        _logger.LogInformation("Exported {Count} invalid records to CSV", dtos.Count);

        return System.Text.Encoding.UTF8.GetBytes(csv.ToString());
    }
}
