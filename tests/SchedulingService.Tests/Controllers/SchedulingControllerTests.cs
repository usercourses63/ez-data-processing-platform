using System;
using System.Collections.Generic;
using System.Diagnostics.Metrics;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using DataProcessing.Scheduling.Controllers;
using DataProcessing.Scheduling.Services;
using DataProcessing.Shared.Monitoring;

namespace DataProcessing.Scheduling.Tests.Controllers;

/// <summary>
/// Unit tests for SchedulingController.
/// The controller uses ISchedulingManager for all scheduling operations and
/// BusinessMetrics for telemetry. Both are mocked to isolate controller logic.
/// </summary>
public class SchedulingControllerTests
{
    private readonly Mock<ISchedulingManager> _schedulingManagerMock;
    private readonly Mock<ILogger<SchedulingController>> _loggerMock;
    private readonly BusinessMetrics _metrics;
    private readonly SchedulingController _controller;

    public SchedulingControllerTests()
    {
        _schedulingManagerMock = new Mock<ISchedulingManager>();
        _loggerMock = new Mock<ILogger<SchedulingController>>();
        // BusinessMetrics has no parameterless ctor and non-virtual methods, so it cannot be
        // mocked directly. Use a real instance backed by a throwaway Meter — the controller only
        // records telemetry fire-and-forget, so a live instance is sufficient for these tests.
        _metrics = new BusinessMetrics(new Meter("scheduling-controller-tests"));

        _controller = new SchedulingController(
            _schedulingManagerMock.Object,
            _loggerMock.Object,
            _metrics);

        // Set up a default HttpContext so TraceIdentifier is available
        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    #region ScheduleDataSourceAsync Tests

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task ScheduleDataSourceAsync_ValidRequest_ManagerSucceeds_ReturnsOkWithSchedule()
    {
        // Arrange
        var dataSourceId = "ds-001";
        var request = new ScheduleDataSourceRequest
        {
            DataSourceName = "Test Source",
            SupplierName = "Supplier A",
            PollingInterval = TimeSpan.FromMinutes(5)
        };

        var expectedStatus = new ScheduleStatus
        {
            DataSourceId = dataSourceId,
            DataSourceName = "Test Source",
            PollingInterval = TimeSpan.FromMinutes(5),
            IsActive = true,
            IsPaused = false,
            ExecutionCount = 0
        };

        _schedulingManagerMock
            .Setup(m => m.ScheduleDataSourcePollingAsync(
                It.Is<DataProcessing.Shared.Entities.DataProcessingDataSource>(ds => ds.ID == dataSourceId),
                It.IsAny<string>()))
            .ReturnsAsync(true);

        _schedulingManagerMock
            .Setup(m => m.GetScheduleStatusAsync(dataSourceId))
            .ReturnsAsync(expectedStatus);

        // Act
        var result = await _controller.ScheduleDataSourceAsync(dataSourceId, request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ScheduleApiResponse>().Subject;
        response.Success.Should().BeTrue();
        response.Schedule.Should().NotBeNull();
        response.Schedule!.DataSourceId.Should().Be(dataSourceId);

        _schedulingManagerMock.Verify(
            m => m.ScheduleDataSourcePollingAsync(It.IsAny<DataProcessing.Shared.Entities.DataProcessingDataSource>(), It.IsAny<string>()),
            Times.Once);
    }

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task ScheduleDataSourceAsync_ManagerReturnsFalse_ReturnsBadRequest()
    {
        // Arrange
        var dataSourceId = "ds-002";
        var request = new ScheduleDataSourceRequest
        {
            DataSourceName = "Test Source",
            PollingInterval = TimeSpan.FromMinutes(5)
        };

        _schedulingManagerMock
            .Setup(m => m.ScheduleDataSourcePollingAsync(It.IsAny<DataProcessing.Shared.Entities.DataProcessingDataSource>(), It.IsAny<string>()))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.ScheduleDataSourceAsync(dataSourceId, request);

        // Assert
        var badRequest = result.Should().BeOfType<BadRequestObjectResult>().Subject;
        var error = badRequest.Value.Should().BeOfType<ErrorResponse>().Subject;
        error.Error.Should().NotBeEmpty();
    }

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task ScheduleDataSourceAsync_ManagerThrowsException_Returns500()
    {
        // Arrange
        var dataSourceId = "ds-003";
        var request = new ScheduleDataSourceRequest
        {
            DataSourceName = "Test Source",
            PollingInterval = TimeSpan.FromMinutes(5)
        };

        _schedulingManagerMock
            .Setup(m => m.ScheduleDataSourcePollingAsync(It.IsAny<DataProcessing.Shared.Entities.DataProcessingDataSource>(), It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("Quartz scheduler not initialized"));

        // Act
        var result = await _controller.ScheduleDataSourceAsync(dataSourceId, request);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Scheduling")]
    public async Task ScheduleDataSourceAsync_NullSupplierName_DefaultsToUnknown()
    {
        // Arrange
        var dataSourceId = "ds-004";
        var request = new ScheduleDataSourceRequest
        {
            DataSourceName = "Test Source",
            SupplierName = null,
            PollingInterval = TimeSpan.FromSeconds(60)
        };

        DataProcessing.Shared.Entities.DataProcessingDataSource? capturedDataSource = null;
        _schedulingManagerMock
            .Setup(m => m.ScheduleDataSourcePollingAsync(
                It.IsAny<DataProcessing.Shared.Entities.DataProcessingDataSource>(),
                It.IsAny<string>()))
            .Callback<DataProcessing.Shared.Entities.DataProcessingDataSource, string>((ds, _) => capturedDataSource = ds)
            .ReturnsAsync(true);

        _schedulingManagerMock
            .Setup(m => m.GetScheduleStatusAsync(dataSourceId))
            .ReturnsAsync(new ScheduleStatus { DataSourceId = dataSourceId });

        // Act
        await _controller.ScheduleDataSourceAsync(dataSourceId, request);

        // Assert
        capturedDataSource.Should().NotBeNull();
        capturedDataSource!.SupplierName.Should().Be("Unknown");
    }

    #endregion

    #region UnscheduleDataSourceAsync Tests

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task UnscheduleDataSourceAsync_ExistingSchedule_ReturnsOk()
    {
        // Arrange
        var dataSourceId = "ds-010";
        _schedulingManagerMock
            .Setup(m => m.UnscheduleDataSourcePollingAsync(dataSourceId, It.IsAny<string>()))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.UnscheduleDataSourceAsync(dataSourceId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ScheduleApiResponse>().Subject;
        response.Success.Should().BeTrue();
    }

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task UnscheduleDataSourceAsync_NoScheduleFound_ReturnsNotFound()
    {
        // Arrange
        var dataSourceId = "ds-notexist";
        _schedulingManagerMock
            .Setup(m => m.UnscheduleDataSourcePollingAsync(dataSourceId, It.IsAny<string>()))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.UnscheduleDataSourceAsync(dataSourceId);

        // Assert
        var notFound = result.Should().BeOfType<NotFoundObjectResult>().Subject;
        var error = notFound.Value.Should().BeOfType<ErrorResponse>().Subject;
        error.Error.Should().NotBeEmpty();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Scheduling")]
    public async Task UnscheduleDataSourceAsync_ManagerThrows_Returns500()
    {
        // Arrange
        var dataSourceId = "ds-err";
        _schedulingManagerMock
            .Setup(m => m.UnscheduleDataSourcePollingAsync(dataSourceId, It.IsAny<string>()))
            .ThrowsAsync(new Exception("Scheduler unavailable"));

        // Act
        var result = await _controller.UnscheduleDataSourceAsync(dataSourceId);

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region UpdatePollingIntervalAsync Tests

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task UpdatePollingIntervalAsync_ValidRequest_ReturnsOkWithUpdatedSchedule()
    {
        // Arrange
        var dataSourceId = "ds-020";
        var request = new UpdateScheduleRequest
        {
            NewPollingInterval = TimeSpan.FromMinutes(10)
        };

        var updatedStatus = new ScheduleStatus
        {
            DataSourceId = dataSourceId,
            PollingInterval = TimeSpan.FromMinutes(10),
            IsActive = true
        };

        _schedulingManagerMock
            .Setup(m => m.UpdatePollingIntervalAsync(dataSourceId, request.NewPollingInterval, It.IsAny<string>()))
            .ReturnsAsync(true);

        _schedulingManagerMock
            .Setup(m => m.GetScheduleStatusAsync(dataSourceId))
            .ReturnsAsync(updatedStatus);

        // Act
        var result = await _controller.UpdatePollingIntervalAsync(dataSourceId, request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ScheduleApiResponse>().Subject;
        response.Success.Should().BeTrue();
        response.Schedule!.PollingInterval.Should().Be(TimeSpan.FromMinutes(10));
    }

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task UpdatePollingIntervalAsync_ScheduleNotFound_ReturnsNotFound()
    {
        // Arrange
        var dataSourceId = "ds-noexist";
        var request = new UpdateScheduleRequest { NewPollingInterval = TimeSpan.FromMinutes(5) };

        _schedulingManagerMock
            .Setup(m => m.UpdatePollingIntervalAsync(dataSourceId, It.IsAny<TimeSpan>(), It.IsAny<string>()))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.UpdatePollingIntervalAsync(dataSourceId, request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region PauseDataSourcePollingAsync Tests

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task PauseDataSourcePollingAsync_ExistingSchedule_ReturnsOkWithPausedStatus()
    {
        // Arrange
        var dataSourceId = "ds-030";
        var pausedStatus = new ScheduleStatus
        {
            DataSourceId = dataSourceId,
            IsActive = true,
            IsPaused = true
        };

        _schedulingManagerMock
            .Setup(m => m.PauseDataSourcePollingAsync(dataSourceId, It.IsAny<string>()))
            .ReturnsAsync(true);

        _schedulingManagerMock
            .Setup(m => m.GetScheduleStatusAsync(dataSourceId))
            .ReturnsAsync(pausedStatus);

        // Act
        var result = await _controller.PauseDataSourcePollingAsync(dataSourceId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ScheduleApiResponse>().Subject;
        response.Success.Should().BeTrue();
        response.Schedule!.IsPaused.Should().BeTrue();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Scheduling")]
    public async Task PauseDataSourcePollingAsync_ScheduleNotFound_ReturnsNotFound()
    {
        // Arrange
        var dataSourceId = "ds-ghost";
        _schedulingManagerMock
            .Setup(m => m.PauseDataSourcePollingAsync(dataSourceId, It.IsAny<string>()))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.PauseDataSourcePollingAsync(dataSourceId);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region ResumeDataSourcePollingAsync Tests

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task ResumeDataSourcePollingAsync_PausedSchedule_ReturnsOkWithActiveStatus()
    {
        // Arrange
        var dataSourceId = "ds-040";
        var activeStatus = new ScheduleStatus
        {
            DataSourceId = dataSourceId,
            IsActive = true,
            IsPaused = false
        };

        _schedulingManagerMock
            .Setup(m => m.ResumeDataSourcePollingAsync(dataSourceId, It.IsAny<string>()))
            .ReturnsAsync(true);

        _schedulingManagerMock
            .Setup(m => m.GetScheduleStatusAsync(dataSourceId))
            .ReturnsAsync(activeStatus);

        // Act
        var result = await _controller.ResumeDataSourcePollingAsync(dataSourceId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ScheduleApiResponse>().Subject;
        response.Success.Should().BeTrue();
        response.Schedule!.IsPaused.Should().BeFalse();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Scheduling")]
    public async Task ResumeDataSourcePollingAsync_ScheduleNotFound_ReturnsNotFound()
    {
        // Arrange
        var dataSourceId = "ds-noexist2";
        _schedulingManagerMock
            .Setup(m => m.ResumeDataSourcePollingAsync(dataSourceId, It.IsAny<string>()))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.ResumeDataSourcePollingAsync(dataSourceId);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region TriggerImmediatePollingAsync Tests

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task TriggerImmediatePollingAsync_ExistingSchedule_ReturnsOk()
    {
        // Arrange
        var dataSourceId = "ds-050";
        _schedulingManagerMock
            .Setup(m => m.TriggerImmediatePollingAsync(dataSourceId, It.IsAny<string>()))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.TriggerImmediatePollingAsync(dataSourceId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ScheduleApiResponse>().Subject;
        response.Success.Should().BeTrue();
        // Schedule is not populated for trigger (immediate fire, no status followup)
        response.Schedule.Should().BeNull();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Scheduling")]
    public async Task TriggerImmediatePollingAsync_NoScheduleRegistered_ReturnsNotFound()
    {
        // Arrange
        var dataSourceId = "ds-unregistered";
        _schedulingManagerMock
            .Setup(m => m.TriggerImmediatePollingAsync(dataSourceId, It.IsAny<string>()))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.TriggerImmediatePollingAsync(dataSourceId);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region GetScheduleStatusAsync Tests

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task GetScheduleStatusAsync_ExistingSchedule_ReturnsOkWithStatus()
    {
        // Arrange
        var dataSourceId = "ds-060";
        var status = new ScheduleStatus
        {
            DataSourceId = dataSourceId,
            DataSourceName = "Reports Source",
            PollingInterval = TimeSpan.FromHours(1),
            IsActive = true,
            IsPaused = false,
            ExecutionCount = 42,
            LastExecution = DateTime.UtcNow.AddHours(-1),
            NextExecution = DateTime.UtcNow.AddHours(1)
        };

        _schedulingManagerMock
            .Setup(m => m.GetScheduleStatusAsync(dataSourceId))
            .ReturnsAsync(status);

        // Act
        var result = await _controller.GetScheduleStatusAsync(dataSourceId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<ScheduleStatusApiResponse>().Subject;
        response.Success.Should().BeTrue();
        response.Status.Should().NotBeNull();
        response.Status!.DataSourceId.Should().Be(dataSourceId);
        response.Status.ExecutionCount.Should().Be(42);
    }

    [Fact]
    [Trait("Priority", "P0")]
    [Trait("Area", "Scheduling")]
    public async Task GetScheduleStatusAsync_NoSchedule_ReturnsNotFound()
    {
        // Arrange
        var dataSourceId = "ds-gone";
        _schedulingManagerMock
            .Setup(m => m.GetScheduleStatusAsync(dataSourceId))
            .ReturnsAsync((ScheduleStatus?)null);

        // Act
        var result = await _controller.GetScheduleStatusAsync(dataSourceId);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region GetAllSchedulesAsync Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Scheduling")]
    public async Task GetAllSchedulesAsync_SchedulesExist_ReturnsOkWithList()
    {
        // Arrange
        var schedules = new List<ScheduleInfo>
        {
            new ScheduleInfo
            {
                DataSourceId = "ds-a",
                DataSourceName = "Source A",
                SupplierName = "Supplier A",
                PollingInterval = TimeSpan.FromMinutes(15),
                IsActive = true,
                IsPaused = false
            },
            new ScheduleInfo
            {
                DataSourceId = "ds-b",
                DataSourceName = "Source B",
                SupplierName = "Supplier B",
                PollingInterval = TimeSpan.FromHours(1),
                IsActive = true,
                IsPaused = true
            }
        };

        _schedulingManagerMock
            .Setup(m => m.GetAllSchedulesAsync())
            .ReturnsAsync(schedules);

        // Act
        var result = await _controller.GetAllSchedulesAsync();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<SchedulesListApiResponse>().Subject;
        response.Success.Should().BeTrue();
        response.TotalCount.Should().Be(2);
        response.Schedules.Should().HaveCount(2);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Scheduling")]
    public async Task GetAllSchedulesAsync_EmptyScheduler_ReturnsOkWithEmptyList()
    {
        // Arrange
        _schedulingManagerMock
            .Setup(m => m.GetAllSchedulesAsync())
            .ReturnsAsync(new List<ScheduleInfo>());

        // Act
        var result = await _controller.GetAllSchedulesAsync();

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeOfType<SchedulesListApiResponse>().Subject;
        response.Success.Should().BeTrue();
        response.TotalCount.Should().Be(0);
        response.Schedules.Should().BeEmpty();
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Scheduling")]
    public async Task GetAllSchedulesAsync_ManagerThrows_Returns500()
    {
        // Arrange
        _schedulingManagerMock
            .Setup(m => m.GetAllSchedulesAsync())
            .ThrowsAsync(new Exception("DB connection lost"));

        // Act
        var result = await _controller.GetAllSchedulesAsync();

        // Assert
        var statusCodeResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusCodeResult.StatusCode.Should().Be(500);
    }

    #endregion
}
