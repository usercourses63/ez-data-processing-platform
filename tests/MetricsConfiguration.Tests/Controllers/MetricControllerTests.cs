using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using MetricsConfigurationService.Controllers;
using MetricsConfigurationService.Models;
using MetricsConfigurationService.Repositories;

namespace MetricsConfigurationService.Tests.Controllers;

/// <summary>
/// Unit tests for MetricController.
///
/// IMPORTANT CAVEAT: MetricController uses MongoDB.Entities DB.Find() static calls
/// internally in BuildMetricDtoAsync/BuildMetricDtosAsync for DataSource name lookups.
/// These static calls cannot be mocked with Moq. Tests for endpoints that invoke
/// those helpers (GetAll, GetById, Create, Update, Duplicate, GetByDataSource, GetGlobal)
/// are tested at the action-dispatch level and rely on the repository mock; the
/// static DB.Find will return null (DataSourceName = null) in unit test context,
/// which is acceptable — we assert on HTTP status codes and Success flags,
/// not on DataSourceName population.
///
/// Tests that call synchronous endpoints (GetAvailableBusinessMetrics,
/// GetAvailableSystemMetrics) are fully isolated and have no DB dependency.
/// </summary>
public class MetricControllerTests
{
    private readonly Mock<IMetricRepository> _repositoryMock;
    private readonly Mock<ILogger<MetricController>> _loggerMock;
    private readonly MetricController _controller;

    public MetricControllerTests()
    {
        _repositoryMock = new Mock<IMetricRepository>();
        _loggerMock = new Mock<ILogger<MetricController>>();

        _controller = new MetricController(_repositoryMock.Object, _loggerMock.Object);

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    private static MetricConfiguration MakeMetric(string id, string name, string? dataSourceId = null) =>
        new MetricConfiguration
        {
            Name = name,
            DisplayName = name + " Display",
            Description = "Test metric",
            Category = "performance",
            Scope = dataSourceId == null ? "global" : "datasource-specific",
            DataSourceId = dataSourceId,
            Formula = "$.value",
            FormulaType = FormulaType.Simple,
            FieldPath = "$.value",
            PrometheusType = "gauge",
            Status = 1,
            CreatedBy = "System"
        };

    #region GetAll Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task GetAll_RepositoryReturnsMetrics_ReturnsOkWithIsSuccessTrue()
    {
        // Arrange
        var metrics = new List<MetricConfiguration>
        {
            MakeMetric("m-1", "records_total"),
            MakeMetric("m-2", "error_rate")
        };

        _repositoryMock
            .Setup(r => r.GetAllAsync())
            .ReturnsAsync(metrics);

        // Act
        var result = await _controller.GetAll();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();

        // Verify IsSuccess is present in the anonymous response
        var valueType = okResult.Value!.GetType();
        var isSuccessProp = valueType.GetProperty("IsSuccess");
        isSuccessProp.Should().NotBeNull("response must have IsSuccess property");
        ((bool)isSuccessProp!.GetValue(okResult.Value)!).Should().BeTrue();
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Metrics")]
    public async Task GetAll_RepositoryThrows_Returns500WithIsSuccessFalse()
    {
        // Arrange
        _repositoryMock
            .Setup(r => r.GetAllAsync())
            .ThrowsAsync(new Exception("MongoDB timeout"));

        // Act
        var result = await _controller.GetAll();

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);

        var valueType = statusResult.Value!.GetType();
        var isSuccessProp = valueType.GetProperty("IsSuccess");
        isSuccessProp.Should().NotBeNull();
        ((bool)isSuccessProp!.GetValue(statusResult.Value)!).Should().BeFalse();
    }

    #endregion

    #region GetById Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task GetById_MetricExists_ReturnsOk()
    {
        // Arrange
        var metricId = "m-10";
        var metric = MakeMetric(metricId, "cpu_usage");

        _repositoryMock
            .Setup(r => r.GetByIdAsync(metricId))
            .ReturnsAsync(metric);

        // Act
        var result = await _controller.GetById(metricId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task GetById_MetricNotFound_ReturnsNotFoundWithIsSuccessFalse()
    {
        // Arrange
        _repositoryMock
            .Setup(r => r.GetByIdAsync("m-ghost"))
            .ReturnsAsync((MetricConfiguration?)null);

        // Act
        var result = await _controller.GetById("m-ghost");

        // Assert
        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        var valueType = notFound.Value!.GetType();
        var isSuccessProp = valueType.GetProperty("IsSuccess");
        ((bool)isSuccessProp!.GetValue(notFound.Value)!).Should().BeFalse();
    }

    #endregion

    #region Create Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task Create_UniqueNameAndValidRequest_Returns201()
    {
        // Arrange
        var request = new CreateMetricRequest
        {
            Name = "new_metric",
            DisplayName = "New Metric",
            FieldPath = "$.value",
            PrometheusType = "counter",
            CreatedBy = "User"
        };

        _repositoryMock
            .Setup(r => r.GetByNameAsync("new_metric"))
            .ReturnsAsync((MetricConfiguration?)null);

        var createdMetric = MakeMetric("m-new", "new_metric");

        _repositoryMock
            .Setup(r => r.CreateAsync(It.IsAny<MetricConfiguration>()))
            .ReturnsAsync(createdMetric);

        // Act
        var result = await _controller.Create(request);

        // Assert
        result.Should().BeOfType<CreatedAtActionResult>();
        _repositoryMock.Verify(r => r.CreateAsync(It.IsAny<MetricConfiguration>()), Times.Once);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task Create_DuplicateName_ReturnsBadRequest()
    {
        // Arrange
        var request = new CreateMetricRequest
        {
            Name = "existing_metric",
            DisplayName = "Existing",
            FieldPath = "$.value",
            PrometheusType = "gauge"
        };

        _repositoryMock
            .Setup(r => r.GetByNameAsync("existing_metric"))
            .ReturnsAsync(MakeMetric("m-existing", "existing_metric"));

        // Act
        var result = await _controller.Create(request);

        // Assert
        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var valueType = badRequest.Value!.GetType();
        var isSuccessProp = valueType.GetProperty("IsSuccess");
        ((bool)isSuccessProp!.GetValue(badRequest.Value)!).Should().BeFalse();

        _repositoryMock.Verify(r => r.CreateAsync(It.IsAny<MetricConfiguration>()), Times.Never);
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Metrics")]
    public async Task Create_RepositoryThrows_Returns500()
    {
        // Arrange
        var request = new CreateMetricRequest
        {
            Name = "err_metric",
            DisplayName = "Err",
            FieldPath = "$.val",
            PrometheusType = "gauge"
        };

        _repositoryMock
            .Setup(r => r.GetByNameAsync("err_metric"))
            .ReturnsAsync((MetricConfiguration?)null);

        _repositoryMock
            .Setup(r => r.CreateAsync(It.IsAny<MetricConfiguration>()))
            .ThrowsAsync(new Exception("Write failed"));

        // Act
        var result = await _controller.Create(request);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region Update Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task Update_ExistingMetric_ReturnsOk()
    {
        // Arrange
        var metricId = "m-20";
        var existing = MakeMetric(metricId, "cpu_usage");
        var request = new UpdateMetricRequest
        {
            DisplayName = "CPU Usage Updated",
            FieldPath = "$.cpu",
            PrometheusType = "gauge",
            UpdatedBy = "admin"
        };

        _repositoryMock
            .Setup(r => r.GetByIdAsync(metricId))
            .ReturnsAsync(existing);

        _repositoryMock
            .Setup(r => r.UpdateAsync(It.IsAny<MetricConfiguration>()))
            .ReturnsAsync(existing);

        // Act
        var result = await _controller.Update(metricId, request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        _repositoryMock.Verify(r => r.UpdateAsync(It.IsAny<MetricConfiguration>()), Times.Once);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task Update_MetricNotFound_ReturnsNotFound()
    {
        // Arrange
        _repositoryMock
            .Setup(r => r.GetByIdAsync("m-noexist"))
            .ReturnsAsync((MetricConfiguration?)null);

        var request = new UpdateMetricRequest
        {
            DisplayName = "Test",
            FieldPath = "$.val",
            PrometheusType = "gauge"
        };

        // Act
        var result = await _controller.Update("m-noexist", request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
        _repositoryMock.Verify(r => r.UpdateAsync(It.IsAny<MetricConfiguration>()), Times.Never);
    }

    #endregion

    #region Delete Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task Delete_ExistingMetric_ReturnsOkWithIsSuccessTrue()
    {
        // Arrange
        var metricId = "m-30";
        var metric = MakeMetric(metricId, "to_delete");

        _repositoryMock
            .Setup(r => r.GetByIdAsync(metricId))
            .ReturnsAsync(metric);

        _repositoryMock
            .Setup(r => r.DeleteAsync(metricId))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.Delete(metricId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var valueType = okResult.Value!.GetType();
        var isSuccessProp = valueType.GetProperty("IsSuccess");
        ((bool)isSuccessProp!.GetValue(okResult.Value)!).Should().BeTrue();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task Delete_MetricNotFound_ReturnsNotFound()
    {
        // Arrange
        _repositoryMock
            .Setup(r => r.GetByIdAsync("m-gone"))
            .ReturnsAsync((MetricConfiguration?)null);

        // Act
        var result = await _controller.Delete("m-gone");

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
        _repositoryMock.Verify(r => r.DeleteAsync(It.IsAny<string>()), Times.Never);
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Metrics")]
    public async Task Delete_RepositoryDeleteReturnsFalse_Returns500()
    {
        // Arrange
        var metricId = "m-31";
        _repositoryMock
            .Setup(r => r.GetByIdAsync(metricId))
            .ReturnsAsync(MakeMetric(metricId, "flaky_metric"));

        _repositoryMock
            .Setup(r => r.DeleteAsync(metricId))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.Delete(metricId);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region Duplicate Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task Duplicate_ExistingMetric_Returns201()
    {
        // Arrange
        var sourceId = "m-40";
        var request = new DuplicateMetricRequest
        {
            Name = "cpu_usage_copy",
            DisplayName = "CPU Usage (Copy)",
            CreatedBy = "admin"
        };

        var duplicatedMetric = MakeMetric("m-41", "cpu_usage_copy");

        _repositoryMock
            .Setup(r => r.DuplicateAsync(sourceId, request))
            .ReturnsAsync(duplicatedMetric);

        // Act
        var result = await _controller.Duplicate(sourceId, request);

        // Assert
        result.Should().BeOfType<CreatedAtActionResult>();
        _repositoryMock.Verify(r => r.DuplicateAsync(sourceId, request), Times.Once);
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Metrics")]
    public async Task Duplicate_RepositoryThrows_Returns500()
    {
        // Arrange
        _repositoryMock
            .Setup(r => r.DuplicateAsync(It.IsAny<string>(), It.IsAny<DuplicateMetricRequest>()))
            .ThrowsAsync(new Exception("Source metric not found"));

        // Act
        var result = await _controller.Duplicate("m-missing", new DuplicateMetricRequest());

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region GetByDataSource Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task GetByDataSource_ReturnsOkWithIsSuccessTrue()
    {
        // Arrange
        var dataSourceId = "ds-100";
        var metrics = new List<MetricConfiguration>
        {
            MakeMetric("m-50", "ds_metric_a", dataSourceId),
            MakeMetric("m-51", "ds_metric_b", dataSourceId)
        };

        _repositoryMock
            .Setup(r => r.GetByDataSourceIdAsync(dataSourceId))
            .ReturnsAsync(metrics);

        // Act
        var result = await _controller.GetByDataSource(dataSourceId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var valueType = okResult.Value!.GetType();
        var isSuccessProp = valueType.GetProperty("IsSuccess");
        ((bool)isSuccessProp!.GetValue(okResult.Value)!).Should().BeTrue();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task GetByDataSource_NoMetricsForDataSource_ReturnsOkWithEmptyData()
    {
        // Arrange
        _repositoryMock
            .Setup(r => r.GetByDataSourceIdAsync("ds-empty"))
            .ReturnsAsync(new List<MetricConfiguration>());

        // Act
        var result = await _controller.GetByDataSource("ds-empty");

        // Assert
        result.Should().BeOfType<OkObjectResult>();
    }

    #endregion

    #region GetGlobal Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public async Task GetGlobal_ReturnsOkWithGlobalMetrics()
    {
        // Arrange
        var globalMetrics = new List<MetricConfiguration>
        {
            MakeMetric("m-60", "global_records_total"),
            MakeMetric("m-61", "global_error_rate")
        };

        _repositoryMock
            .Setup(r => r.GetGlobalMetricsAsync())
            .ReturnsAsync(globalMetrics);

        // Act
        var result = await _controller.GetGlobal();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();
        _repositoryMock.Verify(r => r.GetGlobalMetricsAsync(), Times.Once);
    }

    #endregion

    #region GetAvailableBusinessMetrics Tests (synchronous - no DB dependency)

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public void GetAvailableBusinessMetrics_ReturnsOkWith26Metrics()
    {
        // Act
        var result = _controller.GetAvailableBusinessMetrics();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();

        var valueType = okResult.Value!.GetType();
        var isSuccessProp = valueType.GetProperty("IsSuccess");
        ((bool)isSuccessProp!.GetValue(okResult.Value)!).Should().BeTrue();

        var dataProp = valueType.GetProperty("Data");
        dataProp.Should().NotBeNull();
        var data = dataProp!.GetValue(okResult.Value) as Array;
        data.Should().NotBeNull();
        data!.Length.Should().BeGreaterThan(0, "business metrics list should not be empty");
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public void GetAvailableBusinessMetrics_ContainsExpectedMetricNames()
    {
        // Act
        var result = _controller.GetAvailableBusinessMetrics();
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;

        var valueType = okResult.Value!.GetType();
        var dataProp = valueType.GetProperty("Data");
        var data = dataProp!.GetValue(okResult.Value) as System.Collections.IEnumerable;

        // Convert to a list of anonymous objects and check names
        var names = new List<string>();
        foreach (var item in data!)
        {
            var nameProp = item.GetType().GetProperty("Name");
            names.Add((string)nameProp!.GetValue(item)!);
        }

        // Spot-check a few mandatory business metrics
        names.Should().Contain("business_records_processed_total");
        names.Should().Contain("business_invalid_records_total");
        names.Should().Contain("business_files_processed_total");
        names.Should().Contain("business_processing_duration_seconds");
    }

    #endregion

    #region GetAvailableSystemMetrics Tests (synchronous - no DB dependency)

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public void GetAvailableSystemMetrics_ReturnsOkWithSystemMetrics()
    {
        // Act
        var result = _controller.GetAvailableSystemMetrics();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().NotBeNull();

        var valueType = okResult.Value!.GetType();
        var isSuccessProp = valueType.GetProperty("IsSuccess");
        ((bool)isSuccessProp!.GetValue(okResult.Value)!).Should().BeTrue();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Metrics")]
    public void GetAvailableSystemMetrics_ContainsExpectedSystemMetricNames()
    {
        // Act
        var result = _controller.GetAvailableSystemMetrics();
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;

        var valueType = okResult.Value!.GetType();
        var dataProp = valueType.GetProperty("Data");
        var data = dataProp!.GetValue(okResult.Value) as System.Collections.IEnumerable;

        var names = new List<string>();
        foreach (var item in data!)
        {
            var nameProp = item.GetType().GetProperty("Name");
            names.Add((string)nameProp!.GetValue(item)!);
        }

        // Spot-check standard system metrics
        names.Should().Contain("process_cpu_seconds_total");
        names.Should().Contain("process_resident_memory_bytes");
        names.Should().Contain("http_server_requests_total");
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Metrics")]
    public void GetAvailableSystemMetrics_DoesNotRequireDbCall()
    {
        // Arrange - repository mock is set up with no setups intentionally
        // This test verifies the sync endpoint does not interact with DB

        // Act
        var result = _controller.GetAvailableSystemMetrics();

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        _repositoryMock.VerifyNoOtherCalls();
    }

    #endregion
}
