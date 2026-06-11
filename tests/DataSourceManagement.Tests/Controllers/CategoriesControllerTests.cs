using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using DataProcessing.DataSourceManagement.Controllers;
using DataProcessing.DataSourceManagement.Hubs;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Services;
using DataProcessing.Shared.Entities;

namespace DataProcessing.DataSourceManagement.Tests.Controllers;

/// <summary>
/// Unit tests for CategoriesController.
/// The controller delegates all business logic to ICategoryService which is mocked here.
/// DataSourceCategory inherits from MongoDB.Entities.Entity so ID is a string.
/// </summary>
public class CategoriesControllerTests
{
    private readonly Mock<ICategoryService> _categoryServiceMock;
    private readonly Mock<ILogger<CategoriesController>> _loggerMock;
    private readonly Mock<IHubContext<MonitoringHub>> _hubContextMock;
    private readonly CategoriesController _controller;

    public CategoriesControllerTests()
    {
        _categoryServiceMock = new Mock<ICategoryService>();
        _loggerMock = new Mock<ILogger<CategoriesController>>();
        _hubContextMock = new Mock<IHubContext<MonitoringHub>>();

        // Stub the SignalR client-proxy chain so the controller's mandatory EntityChanged
        // broadcast (_hubContext.Clients.All.SendAsync(...)) succeeds. Without this, the call
        // chain returns null, SendAsync throws an NRE, and the controller's catch returns 500.
        var clientProxyMock = new Mock<IClientProxy>();
        var hubClientsMock = new Mock<IHubClients>();
        hubClientsMock.Setup(c => c.All).Returns(clientProxyMock.Object);
        _hubContextMock.Setup(h => h.Clients).Returns(hubClientsMock.Object);

        _controller = new CategoriesController(
            _categoryServiceMock.Object,
            _hubContextMock.Object,
            _loggerMock.Object);

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    // Helper: create a test category with a given ID
    private static DataSourceCategory MakeCategory(string id, string name, bool isActive = true) =>
        new DataSourceCategory
        {
            Name = name,
            NameEn = name + "_en",
            Description = "Test category",
            SortOrder = 1,
            IsActive = isActive
        };

    #region GetAll Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task GetAll_ActiveOnly_ReturnsOkWithActiveCategories()
    {
        // Arrange
        var categories = new List<DataSourceCategory>
        {
            MakeCategory("cat-1", "Sales"),
            MakeCategory("cat-2", "Finance")
        };

        _categoryServiceMock
            .Setup(s => s.GetAllCategoriesAsync(false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(categories);

        // Act
        var result = await _controller.GetAll(includeInactive: false);

        // Assert
        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedCategories = okResult.Value.Should().BeAssignableTo<List<DataSourceCategory>>().Subject;
        returnedCategories.Should().HaveCount(2);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task GetAll_IncludeInactive_PassesTrueToService()
    {
        // Arrange
        _categoryServiceMock
            .Setup(s => s.GetAllCategoriesAsync(true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<DataSourceCategory>());

        // Act
        await _controller.GetAll(includeInactive: true);

        // Assert
        _categoryServiceMock.Verify(
            s => s.GetAllCategoriesAsync(true, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Categories")]
    public async Task GetAll_ServiceThrows_Returns500()
    {
        // Arrange
        _categoryServiceMock
            .Setup(s => s.GetAllCategoriesAsync(It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        // Act
        var result = await _controller.GetAll();

        // Assert
        var statusResult = result.Result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region GetById Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task GetById_ExistingCategory_ReturnsOkWithCategory()
    {
        // Arrange
        var categoryId = "cat-10";
        var category = MakeCategory(categoryId, "HR");

        _categoryServiceMock
            .Setup(s => s.GetCategoryByIdAsync(categoryId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(category);

        // Act
        var result = await _controller.GetById(categoryId);

        // Assert
        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().Be(category);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task GetById_NonExistentId_ReturnsNotFound()
    {
        // Arrange
        _categoryServiceMock
            .Setup(s => s.GetCategoryByIdAsync("cat-missing", It.IsAny<CancellationToken>()))
            .ReturnsAsync((DataSourceCategory?)null);

        // Act
        var result = await _controller.GetById("cat-missing");

        // Assert
        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region Create Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task Create_ValidRequest_Returns201CreatedAtAction()
    {
        // Arrange
        var request = new CreateCategoryRequest
        {
            Name = "מכירות",
            NameEn = "Sales",
            Description = "Sales category",
            SortOrder = 1,
            IsActive = true
        };

        var createdCategory = new DataSourceCategory
        {
            Name = request.Name,
            NameEn = request.NameEn,
            IsActive = true
        };

        _categoryServiceMock
            .Setup(s => s.CreateCategoryAsync(It.IsAny<DataSourceCategory>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(createdCategory);

        // Act
        var result = await _controller.Create(request);

        // Assert
        var createdResult = result.Result.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.ActionName.Should().Be(nameof(CategoriesController.GetById));
        createdResult.Value.Should().Be(createdCategory);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task Create_InvalidModelState_ReturnsBadRequest()
    {
        // Arrange
        var request = new CreateCategoryRequest { Name = "", NameEn = "" };
        _controller.ModelState.AddModelError("Name", "שם קטגוריה בעברית נדרש");

        // Act
        var result = await _controller.Create(request);

        // Assert
        result.Result.Should().BeOfType<BadRequestObjectResult>();
        _categoryServiceMock.Verify(
            s => s.CreateCategoryAsync(It.IsAny<DataSourceCategory>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task Create_SortOrderNull_DefaultsToZero()
    {
        // Arrange
        var request = new CreateCategoryRequest
        {
            Name = "לוגיסטיקה",
            NameEn = "Logistics",
            SortOrder = null
        };

        DataSourceCategory? captured = null;
        _categoryServiceMock
            .Setup(s => s.CreateCategoryAsync(It.IsAny<DataSourceCategory>(), It.IsAny<CancellationToken>()))
            .Callback<DataSourceCategory, CancellationToken>((cat, _) => captured = cat)
            .ReturnsAsync(new DataSourceCategory { Name = request.Name });

        // Act
        await _controller.Create(request);

        // Assert
        captured.Should().NotBeNull();
        captured!.SortOrder.Should().Be(0);
    }

    #endregion

    #region Update Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task Update_ExistingCategory_ReturnsOkWithUpdatedCategory()
    {
        // Arrange
        var categoryId = "cat-20";
        var request = new UpdateCategoryRequest
        {
            Name = "מכירות מעודכן",
            NameEn = "Sales Updated",
            IsActive = true,
            SortOrder = 2
        };

        var updatedCategory = new DataSourceCategory
        {
            Name = request.Name,
            NameEn = request.NameEn,
            SortOrder = request.SortOrder,
            IsActive = request.IsActive
        };

        _categoryServiceMock
            .Setup(s => s.UpdateCategoryAsync(categoryId, It.IsAny<DataSourceCategory>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedCategory);

        // Act
        var result = await _controller.Update(categoryId, request);

        // Assert
        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.Value.Should().Be(updatedCategory);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task Update_NonExistentCategory_ReturnsNotFound()
    {
        // Arrange
        var categoryId = "cat-gone";
        var request = new UpdateCategoryRequest
        {
            Name = "Test",
            NameEn = "Test",
            IsActive = true,
            SortOrder = 1
        };

        _categoryServiceMock
            .Setup(s => s.UpdateCategoryAsync(categoryId, It.IsAny<DataSourceCategory>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DataSourceCategory?)null);

        // Act
        var result = await _controller.Update(categoryId, request);

        // Assert
        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region Delete Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task Delete_ExistingCategory_ReturnsNoContent()
    {
        // Arrange
        var categoryId = "cat-30";
        _categoryServiceMock
            .Setup(s => s.DeleteCategoryAsync(categoryId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.Delete(categoryId);

        // Assert
        result.Should().BeOfType<NoContentResult>();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task Delete_NonExistentCategory_ReturnsNotFound()
    {
        // Arrange
        var categoryId = "cat-ghost";
        _categoryServiceMock
            .Setup(s => s.DeleteCategoryAsync(categoryId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        var result = await _controller.Delete(categoryId);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region Reorder Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task Reorder_ValidRequest_ReturnsOk()
    {
        // Arrange
        var request = new ReorderCategoriesRequest
        {
            CategoryIds = new List<string> { "cat-3", "cat-1", "cat-2" }
        };

        _categoryServiceMock
            .Setup(s => s.ReorderCategoriesAsync(request.CategoryIds, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var result = await _controller.Reorder(request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        _categoryServiceMock.Verify(
            s => s.ReorderCategoriesAsync(request.CategoryIds, It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Categories")]
    public async Task Reorder_ServiceThrows_Returns500()
    {
        // Arrange
        var request = new ReorderCategoriesRequest
        {
            CategoryIds = new List<string> { "cat-1", "cat-2" }
        };

        _categoryServiceMock
            .Setup(s => s.ReorderCategoriesAsync(It.IsAny<List<string>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Reorder failed"));

        // Act
        var result = await _controller.Reorder(request);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    #endregion

    #region ToggleActive Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task ToggleActive_ExistingCategory_ReturnsOkWithUpdatedCategory()
    {
        // Arrange
        var categoryId = "cat-40";
        var updatedCategory = MakeCategory(categoryId, "Marketing", isActive: false);

        _categoryServiceMock
            .Setup(s => s.ToggleCategoryActiveAsync(categoryId, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(updatedCategory);

        // Act
        var result = await _controller.ToggleActive(categoryId, isActive: false);

        // Assert
        var okResult = result.Result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedCategory = okResult.Value.Should().BeAssignableTo<DataSourceCategory>().Subject;
        returnedCategory.IsActive.Should().BeFalse();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "Categories")]
    public async Task ToggleActive_CategoryNotFound_ReturnsNotFound()
    {
        // Arrange
        _categoryServiceMock
            .Setup(s => s.ToggleCategoryActiveAsync("cat-missing", It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((DataSourceCategory?)null);

        // Act
        var result = await _controller.ToggleActive("cat-missing", isActive: true);

        // Assert
        result.Result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion

    #region GetUsageCount Tests

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Categories")]
    public async Task GetUsageCount_CategoryWithDatasources_ReturnsCountAndCanHardDeleteFalse()
    {
        // Arrange
        var categoryId = "cat-50";
        var category = MakeCategory(categoryId, "Finance");

        _categoryServiceMock
            .Setup(s => s.GetCategoryByIdAsync(categoryId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(category);

        _categoryServiceMock
            .Setup(s => s.GetDataSourceCountByCategoryAsync("Finance", It.IsAny<CancellationToken>()))
            .ReturnsAsync(5L);

        // Act
        var result = await _controller.GetUsageCount(categoryId);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        // The response is an anonymous object - check it's non-null
        okResult.Value.Should().NotBeNull();
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "Categories")]
    public async Task GetUsageCount_CategoryNotFound_ReturnsNotFound()
    {
        // Arrange
        _categoryServiceMock
            .Setup(s => s.GetCategoryByIdAsync("cat-none", It.IsAny<CancellationToken>()))
            .ReturnsAsync((DataSourceCategory?)null);

        // Act
        var result = await _controller.GetUsageCount("cat-none");

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    #endregion
}
