using DataProcessing.Shared.Entities;
using InvalidRecordsService.Models.Requests;
using InvalidRecordsService.Models.Responses;
using MongoDB.Entities;

namespace InvalidRecordsService.Repositories;

public class InvalidRecordRepository : IInvalidRecordRepository
{
    public async Task<(List<DataProcessingInvalidRecord> Records, int TotalCount)> GetPagedAsync(
        InvalidRecordListRequest request)
    {
        // Build base query
        var query = DB.Find<DataProcessingInvalidRecord>();

        // Apply data source filter
        if (!string.IsNullOrEmpty(request.DataSourceId))
        {
            query.Match(r => r.DataSourceId == request.DataSourceId);
        }

        // Apply error type filter
        if (!string.IsNullOrEmpty(request.ErrorType))
        {
            query.Match(r => r.ErrorType == request.ErrorType);
        }

        // Apply date range filters
        if (request.StartDate.HasValue)
        {
            query.Match(r => r.CreatedAt >= request.StartDate.Value);
        }

        if (request.EndDate.HasValue)
        {
            query.Match(r => r.CreatedAt <= request.EndDate.Value);
        }

        // Apply search filter
        if (!string.IsNullOrEmpty(request.Search))
        {
            query.Match(r => r.FileName.Contains(request.Search) || r.DataSourceId.Contains(request.Search));
        }

        // Apply status filter
        if (!string.IsNullOrEmpty(request.Status))
        {
            switch (request.Status.ToLower())
            {
                case "reviewed":
                    query.Match(r => r.IsReviewed == true && r.IsIgnored == false);
                    break;
                case "ignored":
                    query.Match(r => r.IsIgnored == true);
                    break;
                case "pending":
                    query.Match(r => r.IsReviewed == false);
                    break;
            }
        }

        // Get total count (execute query to get count)
        var allMatchingRecords = await query.ExecuteAsync();
        var totalCount = allMatchingRecords.Count;

        // Apply sorting and pagination on the filtered results
        var records = allMatchingRecords
            .OrderByDescending(r => r.CreatedAt)
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToList();

        return (records, totalCount);
    }

    public async Task<DataProcessingInvalidRecord?> GetByIdAsync(string id)
    {
        return await DB.Find<DataProcessingInvalidRecord>()
            .Match(r => r.ID == id)
            .ExecuteFirstAsync();
    }

    public async Task<List<DataProcessingInvalidRecord>> GetByDataSourceAsync(string dataSourceId)
    {
        return await DB.Find<DataProcessingInvalidRecord>()
            .Match(r => r.DataSourceId == dataSourceId)
            .Sort(r => r.CreatedAt, Order.Descending)
            .ExecuteAsync();
    }

    public async Task<List<DataProcessingInvalidRecord>> GetActiveByDataSourceAsync(string dataSourceId)
    {
        return await DB.Find<DataProcessingInvalidRecord>()
            .Match(r => r.DataSourceId == dataSourceId && !r.IsIgnored && !r.IsDeleted)
            .Sort(r => r.CreatedAt, Order.Descending)
            .ExecuteAsync();
    }

    public async Task<StatisticsDto> GetStatisticsAsync()
    {
        var allRecords = await DB.Find<DataProcessingInvalidRecord>()
            .ExecuteAsync();

        var stats = new StatisticsDto
        {
            TotalInvalidRecords = allRecords.Count,
            ReviewedRecords = allRecords.Count(r => r.IsReviewed),
            IgnoredRecords = allRecords.Count(r => r.IsIgnored)
        };

        // Group by data source
        stats.ByDataSource = allRecords
            .GroupBy(r => r.DataSourceId)
            .ToDictionary(g => g.Key, g => g.Count());

        // Group by error type
        stats.ByErrorType = allRecords
            .GroupBy(r => r.ErrorType)
            .ToDictionary(g => g.Key, g => g.Count());

        // Group by severity
        stats.BySeverity = allRecords
            .GroupBy(r => r.Severity)
            .ToDictionary(g => g.Key, g => g.Count());

        return stats;
    }

    public async Task UpdateStatusAsync(string id, string reviewedBy, string? notes, bool ignore)
    {
        var record = await GetByIdAsync(id);
        if (record != null)
        {
            record.MarkAsReviewed(reviewedBy, notes, ignore);
            await record.SaveAsync();
        }
    }

    public async Task DeleteAsync(string id)
    {
        await DB.DeleteAsync<DataProcessingInvalidRecord>(id);
    }

    public async Task<int> BulkDeleteAsync(List<string> ids)
    {
        var deleteResult = await DB.DeleteAsync<DataProcessingInvalidRecord>(r => ids.Contains(r.ID));
        return (int)deleteResult.DeletedCount;
    }
}
