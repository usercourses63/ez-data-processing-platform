namespace DataProcessing.Shared.Converters;

/// <summary>
/// Interface for converting file formats to JSON
/// All files are normalized to JSON format for validation
/// </summary>
public interface IFormatConverter
{
    /// <summary>
    /// Gets the source format this converter handles (e.g., "csv", "xml", "excel", "json")
    /// </summary>
    string SourceFormat { get; }

    /// <summary>
    /// Converts the source format to JSON
    /// </summary>
    /// <param name="sourceStream">Input stream containing the source format data</param>
    /// <param name="metadata">Optional metadata about the source format (encoding, delimiters, etc.)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>JSON string representation of the data</returns>
    Task<string> ConvertToJsonAsync(
        Stream sourceStream,
        Dictionary<string, object>? metadata = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Validates if the stream contains valid data for this format
    /// </summary>
    /// <param name="stream">Input stream to validate</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if valid, false otherwise</returns>
    Task<bool> IsValidFormatAsync(
        Stream stream,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Extracts metadata from the source format
    /// Used for format reconstruction later
    /// </summary>
    /// <param name="sourceStream">Input stream</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Metadata dictionary</returns>
    Task<Dictionary<string, object>> ExtractMetadataAsync(
        Stream sourceStream,
        CancellationToken cancellationToken = default);
}
