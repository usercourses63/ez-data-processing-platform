namespace DataProcessing.DataSourceManagement.Models.Requests;

/// <summary>
/// Request model for listing files on a server
/// </summary>
public class ListFilesRequest
{
    /// <summary>
    /// Relative path from server base path (optional)
    /// </summary>
    public string? Path { get; set; }

    /// <summary>
    /// File pattern to match (e.g., "*.csv", "*")
    /// </summary>
    public string Pattern { get; set; } = "*";
}

/// <summary>
/// Request model for reading a file from a server
/// </summary>
public class ReadFileRequest
{
    /// <summary>
    /// Full path to the file on the server
    /// </summary>
    public string FilePath { get; set; } = string.Empty;
}

/// <summary>
/// Request model for writing a file to a server
/// </summary>
public class WriteFileRequest
{
    /// <summary>
    /// Destination file path on the server
    /// </summary>
    public string FilePath { get; set; } = string.Empty;

    /// <summary>
    /// File content as base64-encoded string
    /// </summary>
    public string Content { get; set; } = string.Empty;
}

/// <summary>
/// Generic response wrapper for file operations
/// </summary>
public class FileOperationResponse
{
    /// <summary>
    /// Whether the operation succeeded
    /// </summary>
    public bool IsSuccess { get; set; }

    /// <summary>
    /// Error message if operation failed
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Creates a successful response
    /// </summary>
    public static FileOperationResponse Success() => new() { IsSuccess = true };

    /// <summary>
    /// Creates a failed response with error message
    /// </summary>
    public static FileOperationResponse Failure(string errorMessage) => new()
    {
        IsSuccess = false,
        ErrorMessage = errorMessage
    };
}
