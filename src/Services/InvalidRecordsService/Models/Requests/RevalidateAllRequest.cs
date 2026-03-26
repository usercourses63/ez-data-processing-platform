namespace InvalidRecordsService.Models.Requests;

public class RevalidateAllRequest
{
    public string? DataSourceId { get; set; }
    public string? TriggeredBy { get; set; } = "User";
}
