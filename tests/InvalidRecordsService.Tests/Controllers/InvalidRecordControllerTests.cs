using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using InvalidRecordsService.Controllers;
using InvalidRecordsService.Models.Requests;
using InvalidRecordsService.Models.Responses;
using InvalidRecordsService.Services;

namespace InvalidRecordsService.Tests.Controllers;

/// <summary>
/// Unit tests for InvalidRecordController.
/// Tests cover: list, get-by-id, statistics, update-status, delete (single + bulk),
/// correct, reprocess (single + bulk), bulk-ignore, and export.
/// Both IInvalidRecordService and ICorrectionService are mocked.
/// </summary>
public class InvalidRecordControllerTests
{
    private readonly Mock<IInvalidRecordService> _serviceMock;
    private readonly Mock<ICorrectionService> _correctionServiceMock;
    private readonly Mock<IRevalidationService> _revalidationServiceMock;
    private readonly Mock<ILogger<InvalidRecordController>> _loggerMock;
    private readonly InvalidRecordController _controller;

    public InvalidRecordControllerTests()
    {
        _serviceMock = new Mock<IInvalidRecordService>();
        _correctionServiceMock = new Mock<ICorrectionService>();
        _revalidationServiceMock = new Mock<IRevalidationService>();
        _loggerMock = new Mock<ILogger<InvalidRecordController>>();

        _controller = new InvalidRecordController(
            _serviceMock.Object,
            _correctionServiceMock.Object,
            _revalidationServiceMock.Object,
            _loggerMock.Object);

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static InvalidRecordDto MakeRecord(string id) => new InvalidRecordDto
    {
        Id = id,
        DataSourceId = "ds-001",
        DataSourceName = "Test Source",
        FileName = "data.csv",
        LineNumber = 5,
        ErrorType = "Schema",
        Severity = "Error",
        Errors = new List<ValidationErrorDto>()
    };

    #region GetInvalidRecords Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task GetInvalidRecords_ReturnsOkWithPagedResult()
    {
        // Arrange
        var request = new InvalidRecordListRequest { Page = 1, PageSize = 10 };
        var listResponse = new InvalidRecordListResponse
        {
            Items = new List<InvalidRecordDto> { MakeRecord("rec-1"), MakeRecord("rec-2") },
            TotalCount = 2,
            Page = 1,
            PageSize = 10
        };

        _serviceMock
            .Setup(s => s.GetListAsync(request))
            .ReturnsAsync(listResponse);

        // Act
        var result = await _controller.GetInvalidRecords(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "InvalidRecords")]
    public async Task GetInvalidRecords_ServiceThrows_Returns500()
    {
        // Arrange
        var request = new InvalidRecordListRequest();
        _serviceMock
            .Setup(s => s.GetListAsync(request))
            .ThrowsAsync(new Exception("DB connection failed"));

        // Act
        var result = await _controller.GetInvalidRecords(request);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region GetInvalidRecord (by ID) Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task GetInvalidRecord_ExistingId_ReturnsOkWithRecord()
    {
        // Arrange
        var recordId = "rec-100";
        var record = MakeRecord(recordId);
        _serviceMock
            .Setup(s => s.GetByIdAsync(recordId))
            .ReturnsAsync(record);

        // Act
        var result = await _controller.GetInvalidRecord(recordId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task GetInvalidRecord_NonExistentId_ReturnsNotFound()
    {
        // Arrange
        _serviceMock
            .Setup(s => s.GetByIdAsync("rec-ghost"))
            .ReturnsAsync((InvalidRecordDto?)null);

        // Act
        var result = await _controller.GetInvalidRecord("rec-ghost");

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region GetStatistics Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task GetStatistics_ReturnsOkWithStatisticsDto()
    {
        // Arrange
        var stats = new StatisticsDto
        {
            TotalInvalidRecords = 150,
            ReviewedRecords = 50,
            IgnoredRecords = 20,
            ByDataSource = new Dictionary<string, int> { { "ds-001", 100 }, { "ds-002", 50 } },
            ByErrorType = new Dictionary<string, int> { { "Schema", 80 }, { "Type", 70 } }
        };

        _serviceMock
            .Setup(s => s.GetStatisticsAsync())
            .ReturnsAsync(stats);

        // Act
        var result = await _controller.GetStatistics();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
        _serviceMock.Verify(s => s.GetStatisticsAsync(), Times.Once);
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "InvalidRecords")]
    public async Task GetStatistics_ServiceThrows_Returns500()
    {
        // Arrange
        _serviceMock
            .Setup(s => s.GetStatisticsAsync())
            .ThrowsAsync(new Exception("Aggregation failed"));

        // Act
        var result = await _controller.GetStatistics();

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region UpdateStatus Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task UpdateStatus_ExistingRecord_ReturnsOk()
    {
        // Arrange
        var recordId = "rec-200";
        var request = new UpdateStatusRequest
        {
            Status = "InProgress",
            Notes = "Being reviewed",
            UpdatedBy = "operator1"
        };

        _serviceMock
            .Setup(s => s.GetByIdAsync(recordId))
            .ReturnsAsync(MakeRecord(recordId));

        _serviceMock
            .Setup(s => s.UpdateStatusAsync(recordId, request))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _controller.UpdateStatus(recordId, request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        _serviceMock.Verify(s => s.UpdateStatusAsync(recordId, request), Times.Once);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task UpdateStatus_RecordNotFound_ReturnsNotFound()
    {
        // Arrange
        var recordId = "rec-noexist";
        var request = new UpdateStatusRequest { Status = "Ignored", UpdatedBy = "user" };

        _serviceMock
            .Setup(s => s.GetByIdAsync(recordId))
            .ReturnsAsync((InvalidRecordDto?)null);

        // Act
        var result = await _controller.UpdateStatus(recordId, request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
        _serviceMock.Verify(s => s.UpdateStatusAsync(It.IsAny<string>(), It.IsAny<UpdateStatusRequest>()), Times.Never);
    }

    #endregion

    #region DeleteRecord Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task DeleteRecord_ExistingRecord_ReturnsOk()
    {
        // Arrange
        var recordId = "rec-300";
        _serviceMock
            .Setup(s => s.GetByIdAsync(recordId))
            .ReturnsAsync(MakeRecord(recordId));

        _serviceMock
            .Setup(s => s.BulkDeleteAsync(It.Is<BulkOperationRequest>(r => r.RecordIds.Contains(recordId))))
            .ReturnsAsync(new BulkOperationResult { TotalRequested = 1, Successful = 1, Failed = 0 });

        // Act
        var result = await _controller.DeleteRecord(recordId, "admin");

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        _serviceMock.Verify(
            s => s.BulkDeleteAsync(It.Is<BulkOperationRequest>(r => r.RecordIds.Contains(recordId) && r.RequestedBy == "admin")),
            Times.Once);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task DeleteRecord_RecordNotFound_ReturnsNotFound()
    {
        // Arrange
        var recordId = "rec-ghost";
        _serviceMock
            .Setup(s => s.GetByIdAsync(recordId))
            .ReturnsAsync((InvalidRecordDto?)null);

        // Act
        var result = await _controller.DeleteRecord(recordId);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
        _serviceMock.Verify(s => s.BulkDeleteAsync(It.IsAny<BulkOperationRequest>()), Times.Never);
    }

    #endregion

    #region BulkDelete Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task BulkDelete_MultipleRecords_ReturnsOkWithResult()
    {
        // Arrange
        var request = new BulkOperationRequest
        {
            RecordIds = new List<string> { "rec-1", "rec-2", "rec-3" },
            RequestedBy = "admin"
        };

        var operationResult = new BulkOperationResult
        {
            TotalRequested = 3,
            Successful = 3,
            Failed = 0,
            Errors = new List<BulkOperationError>()
        };

        _serviceMock
            .Setup(s => s.BulkDeleteAsync(request))
            .ReturnsAsync(operationResult);

        // Act
        var result = await _controller.BulkDelete(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
        _serviceMock.Verify(s => s.BulkDeleteAsync(request), Times.Once);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task BulkDelete_PartialFailure_ReturnsOkWithPartialResult()
    {
        // Arrange
        var request = new BulkOperationRequest
        {
            RecordIds = new List<string> { "rec-1", "rec-2" },
            RequestedBy = "admin"
        };

        var operationResult = new BulkOperationResult
        {
            TotalRequested = 2,
            Successful = 1,
            Failed = 1,
            Errors = new List<BulkOperationError>
            {
                new BulkOperationError { RecordId = "rec-2", Error = "Record already deleted" }
            }
        };

        _serviceMock
            .Setup(s => s.BulkDeleteAsync(request))
            .ReturnsAsync(operationResult);

        // Act
        var result = await _controller.BulkDelete(request);

        // Assert
        // Still returns OK even with partial failures (result object contains the breakdown)
        result.Should().BeOfType<OkObjectResult>();
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "InvalidRecords")]
    public async Task BulkDelete_ServiceThrows_Returns500()
    {
        // Arrange
        var request = new BulkOperationRequest
        {
            RecordIds = new List<string> { "rec-1" },
            RequestedBy = "admin"
        };

        _serviceMock
            .Setup(s => s.BulkDeleteAsync(request))
            .ThrowsAsync(new Exception("DB write failed"));

        // Act
        var result = await _controller.BulkDelete(request);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region CorrectRecord Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task CorrectRecord_ValidCorrection_ReturnsOk()
    {
        // Arrange
        var recordId = "rec-400";
        var request = new CorrectRecordRequest
        {
            CorrectedData = new { name = "Alice", value = 100 },
            CorrectedBy = "editor1",
            AutoReprocess = true
        };

        var correctionResult = new CorrectionResult
        {
            Success = true,
            Message = "Record corrected and reprocessed",
            ValidationResultId = "vr-001"
        };

        _correctionServiceMock
            .Setup(s => s.CorrectRecordAsync(recordId, request))
            .ReturnsAsync(correctionResult);

        // Act
        var result = await _controller.CorrectRecord(recordId, request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task CorrectRecord_CorrectionFails_ReturnsBadRequest()
    {
        // Arrange
        var recordId = "rec-401";
        var request = new CorrectRecordRequest
        {
            CorrectedData = new { name = "" },
            CorrectedBy = "editor1"
        };

        var correctionResult = new CorrectionResult
        {
            Success = false,
            Message = "Corrected data fails schema validation"
        };

        _correctionServiceMock
            .Setup(s => s.CorrectRecordAsync(recordId, request))
            .ReturnsAsync(correctionResult);

        // Act
        var result = await _controller.CorrectRecord(recordId, request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region ReprocessRecord Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task ReprocessRecord_ValidRecord_ReturnsOk()
    {
        // Arrange
        var recordId = "rec-500";
        var reprocessResult = new ReprocessResult
        {
            Success = true,
            IsValid = true,
            Message = "Record reprocessed successfully"
        };

        _correctionServiceMock
            .Setup(s => s.ReprocessRecordAsync(recordId))
            .ReturnsAsync(reprocessResult);

        // Act
        var result = await _controller.ReprocessRecord(recordId);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        _correctionServiceMock.Verify(s => s.ReprocessRecordAsync(recordId), Times.Once);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task ReprocessRecord_ReprocessFails_ReturnsBadRequest()
    {
        // Arrange
        var recordId = "rec-501";
        var reprocessResult = new ReprocessResult
        {
            Success = false,
            IsValid = false,
            Message = "Record not found in pipeline",
            ValidationErrors = new List<string> { "Missing required field: id" }
        };

        _correctionServiceMock
            .Setup(s => s.ReprocessRecordAsync(recordId))
            .ReturnsAsync(reprocessResult);

        // Act
        var result = await _controller.ReprocessRecord(recordId);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region BulkReprocess Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task BulkReprocess_ValidRequest_ReturnsOkWithResult()
    {
        // Arrange
        var request = new BulkOperationRequest
        {
            RecordIds = new List<string> { "rec-1", "rec-2" },
            RequestedBy = "admin"
        };

        var operationResult = new BulkOperationResult
        {
            TotalRequested = 2,
            Successful = 2,
            Failed = 0
        };

        _correctionServiceMock
            .Setup(s => s.BulkReprocessAsync(request))
            .ReturnsAsync(operationResult);

        // Act
        var result = await _controller.BulkReprocess(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "InvalidRecords")]
    public async Task BulkReprocess_ServiceThrows_Returns500()
    {
        // Arrange
        var request = new BulkOperationRequest
        {
            RecordIds = new List<string> { "rec-1" },
            RequestedBy = "admin"
        };

        _correctionServiceMock
            .Setup(s => s.BulkReprocessAsync(request))
            .ThrowsAsync(new Exception("Kafka unavailable"));

        // Act
        var result = await _controller.BulkReprocess(request);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region BulkIgnore Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task BulkIgnore_ValidRequest_ReturnsOkWithResult()
    {
        // Arrange
        var request = new BulkOperationRequest
        {
            RecordIds = new List<string> { "rec-1", "rec-2", "rec-3" },
            RequestedBy = "reviewer"
        };

        var operationResult = new BulkOperationResult
        {
            TotalRequested = 3,
            Successful = 3,
            Failed = 0
        };

        _correctionServiceMock
            .Setup(s => s.BulkIgnoreAsync(request))
            .ReturnsAsync(operationResult);

        // Act
        var result = await _controller.BulkIgnore(request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        _correctionServiceMock.Verify(s => s.BulkIgnoreAsync(request), Times.Once);
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "InvalidRecords")]
    public async Task BulkIgnore_ServiceThrows_Returns500()
    {
        // Arrange
        var request = new BulkOperationRequest
        {
            RecordIds = new List<string> { "rec-1" },
            RequestedBy = "reviewer"
        };

        _correctionServiceMock
            .Setup(s => s.BulkIgnoreAsync(request))
            .ThrowsAsync(new Exception("Service error"));

        // Act
        var result = await _controller.BulkIgnore(request);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region Export Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "InvalidRecords")]
    public async Task ExportToCsv_ValidRequest_ReturnsCsvFile()
    {
        // Arrange
        var request = new ExportRequest
        {
            Format = "CSV",
            Filters = new InvalidRecordListRequest { DataSourceId = "ds-001" }
        };

        var csvContent = "id,dataSourceId,fileName,errors\nrec-1,ds-001,data.csv,schema error";
        var csvBytes = Encoding.UTF8.GetBytes(csvContent);

        _serviceMock
            .Setup(s => s.ExportToCsvAsync(request))
            .ReturnsAsync(csvBytes);

        // Act
        var result = await _controller.ExportToCsv(request);

        // Assert
        var fileResult = result.Should().BeOfType<FileContentResult>().Subject;
        fileResult.ContentType.Should().Be("text/csv");
        fileResult.FileContents.Should().BeEquivalentTo(csvBytes);
        fileResult.FileDownloadName.Should().StartWith("invalid-records-");
        fileResult.FileDownloadName.Should().EndWith(".csv");
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "InvalidRecords")]
    public async Task ExportToCsv_ServiceThrows_Returns500()
    {
        // Arrange
        var request = new ExportRequest { Format = "CSV" };
        _serviceMock
            .Setup(s => s.ExportToCsvAsync(request))
            .ThrowsAsync(new Exception("Export failed"));

        // Act
        var result = await _controller.ExportToCsv(request);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region Health Tests

    [Fact]
    [Trait("Priority", "P3")]
    [Trait("Area", "InvalidRecords")]
    public void Health_ReturnsOkWithHealthyStatus()
    {
        // Act
        var result = _controller.Health();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    #endregion
}
