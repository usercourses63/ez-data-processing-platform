using InvalidRecordsService.Models.Requests;
using InvalidRecordsService.Models.Responses;

namespace InvalidRecordsService.Services;

public interface IInvalidRecordService
{
    Task<InvalidRecordListResponse> GetListAsync(InvalidRecordListRequest request);
    Task<InvalidRecordDto?> GetByIdAsync(string id);
    Task<StatisticsDto> GetStatisticsAsync();
    Task UpdateStatusAsync(string id, UpdateStatusRequest request);
    Task<BulkOperationResult> BulkDeleteAsync(BulkOperationRequest request);
    Task<byte[]> ExportToCsvAsync(ExportRequest request);
    Task<int> GetRevalidatableCountAsync(string? dataSourceId);
}
