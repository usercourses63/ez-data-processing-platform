using MongoDB.Entities;
using MongoDB.Bson;
using System.ComponentModel.DataAnnotations;

namespace DataProcessing.Shared.Entities;

/// <summary>
/// Represents a record that failed validation during file processing
/// </summary>
[Collection("DataProcessingInvalidRecord")]
public class DataProcessingInvalidRecord : DataProcessingBaseEntity
{
    /// <summary>
    /// ID of the data source this invalid record belongs to
    /// </summary>
    [Required]
    [StringLength(24)]
    public string DataSourceId { get; set; } = string.Empty;

    /// <summary>
    /// Name of the file containing this invalid record
    /// </summary>
    [Required]
    [StringLength(500)]
    public string FileName { get; set; } = string.Empty;

    /// <summary>
    /// ID of the validation result this record is associated with
    /// </summary>
    [Required]
    [StringLength(24)]
    public string ValidationResultId { get; set; } = string.Empty;

    /// <summary>
    /// The original record data that failed validation
    /// </summary>
    [Required]
    public BsonDocument OriginalRecord { get; set; } = new();

    /// <summary>
    /// List of validation errors found in this record
    /// </summary>
    [Required]
    public List<string> ValidationErrors { get; set; } = new();

    /// <summary>
    /// Type or category of error (e.g., "SchemaValidation", "DataType", "RequiredField")
    /// </summary>
    [Required]
    [StringLength(100)]
    public string ErrorType { get; set; } = string.Empty;

    /// <summary>
    /// Severity level of the validation error
    /// </summary>
    [StringLength(20)]
    public string Severity { get; set; } = "Error";

    /// <summary>
    /// Line number in the original file where this record was found
    /// </summary>
    public int? LineNumber { get; set; }

    /// <summary>
    /// Column name that caused the validation error (if applicable)
    /// </summary>
    [StringLength(200)]
    public string? FieldName { get; set; }

    /// <summary>
    /// Expected value or format for the field that failed validation
    /// </summary>
    [StringLength(500)]
    public string? ExpectedValue { get; set; }

    /// <summary>
    /// Actual value that was found in the record
    /// </summary>
    [StringLength(500)]
    public string? ActualValue { get; set; }

    /// <summary>
    /// Whether this record has been reviewed by a user
    /// </summary>
    public bool IsReviewed { get; set; } = false;

    /// <summary>
    /// User who reviewed this invalid record
    /// </summary>
    [StringLength(100)]
    public string? ReviewedBy { get; set; }

    /// <summary>
    /// Date when this record was reviewed
    /// </summary>
    public DateTime? ReviewedAt { get; set; }

    /// <summary>
    /// Notes or comments about this invalid record
    /// </summary>
    [StringLength(2000)]
    public string? ReviewNotes { get; set; }

    /// <summary>
    /// Whether this record should be ignored in future processing
    /// </summary>
    public bool IsIgnored { get; set; } = false;

    /// <summary>
    /// Schema version that was used when this record was originally validated.
    /// Used to detect records that may benefit from revalidation after schema changes.
    /// </summary>
    public int ValidatedWithSchemaVersion { get; set; } = 1;

    /// <summary>
    /// Adds a validation error to this record
    /// </summary>
    public void AddValidationError(string error, string? fieldName = null, string? expectedValue = null, string? actualValue = null)
    {
        ValidationErrors.Add(error);
        if (!string.IsNullOrEmpty(fieldName))
            FieldName = fieldName;
        if (!string.IsNullOrEmpty(expectedValue))
            ExpectedValue = expectedValue;
        if (!string.IsNullOrEmpty(actualValue))
            ActualValue = actualValue;
        MarkAsModified();
    }

    /// <summary>
    /// Marks this record as reviewed
    /// </summary>
    public void MarkAsReviewed(string reviewedBy, string? notes = null, bool ignore = false)
    {
        IsReviewed = true;
        ReviewedBy = reviewedBy;
        ReviewedAt = DateTime.UtcNow;
        ReviewNotes = notes;
        IsIgnored = ignore;
        MarkAsModified(reviewedBy);
    }

    /// <summary>
    /// Gets a summary of all validation errors as a single string
    /// </summary>
    public string GetErrorSummary()
    {
        return ValidationErrors.Count > 0 ? string.Join("; ", ValidationErrors) : "No errors";
    }
}
