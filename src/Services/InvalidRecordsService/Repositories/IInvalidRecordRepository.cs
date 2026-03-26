using DataProcessing.Shared.Entities;
using InvalidRecordsService.Models.Requests;
using InvalidRecordsService.Models.Responses;

namespace InvalidRecordsService.Repositories;

public interface IInvalidRecordRepository
{
    Task<(List<DataProcessingInvalidRecord> Records, int TotalCount)> GetPagedAsync(InvalidRecordListRequest request);
    Task<DataProcessingInvalidRecord?> GetByIdAsync(string id);
    Task<List<DataProcessingInvalidRecord>> GetByDataSourceAsync(string dataSourceId);
    Task<List<DataProcessingInvalidRecord>> GetActiveByDataSourceAsync(string dataSourceId);
    Task<StatisticsDto> GetStatisticsAsync();
    Task UpdateStatusAsync(string id, string reviewedBy, string? notes, bool ignore);
    Task DeleteAsync(string id);
    Task<int> BulkDeleteAsync(List<string> ids);
}
