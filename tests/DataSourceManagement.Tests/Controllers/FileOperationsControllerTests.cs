using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using FluentAssertions;
using DataProcessing.DataSourceManagement.Controllers;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Services;
using DataProcessing.Shared.Connectors;

namespace DataProcessing.DataSourceManagement.Tests.Controllers;

/// <summary>
/// Unit tests for FileOperationsController.
/// The controller proxies file operations (list/read/write) to IFileOperationsService.
/// KeyNotFoundException -> 404, InvalidOperationException -> 400, generic Exception -> 500.
/// Assumption: DiscoveredFile is a model from DataProcessing.Shared.Connectors.
/// </summary>
public class FileOperationsControllerTests
{
    private readonly Mock<IFileOperationsService> _fileOpServiceMock;
    private readonly Mock<ILogger<FileOperationsController>> _loggerMock;
    private readonly FileOperationsController _controller;

    public FileOperationsControllerTests()
    {
        _fileOpServiceMock = new Mock<IFileOperationsService>();
        _loggerMock = new Mock<ILogger<FileOperationsController>>();
        _controller = new FileOperationsController(_fileOpServiceMock.Object, _loggerMock.Object);

        _controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
    }

    #region ListFiles Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task ListFiles_ValidServerAndPath_ReturnsOkWithFileList()
    {
        // Arrange
        var serverId = "srv-001";
        var request = new ListFilesRequest { Path = "/data/imports", Pattern = "*.csv" };

        var files = new List<DiscoveredFile>
        {
            new DiscoveredFile { FileName = "file1.csv", FullPath = "/data/imports/file1.csv" },
            new DiscoveredFile { FileName = "file2.csv", FullPath = "/data/imports/file2.csv" }
        };

        _fileOpServiceMock
            .Setup(s => s.ListFilesAsync(serverId, request.Path, "*.csv", It.IsAny<CancellationToken>()))
            .ReturnsAsync(files);

        // Act
        var result = await _controller.ListFiles(serverId, request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var returnedFiles = okResult.Value.Should().BeAssignableTo<List<DiscoveredFile>>().Subject;
        returnedFiles.Should().HaveCount(2);
        returnedFiles[0].FileName.Should().Be("file1.csv");
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task ListFiles_NullPattern_DefaultsToWildcard()
    {
        // Arrange
        var serverId = "srv-002";
        var request = new ListFilesRequest { Path = "/data", Pattern = null };

        _fileOpServiceMock
            .Setup(s => s.ListFilesAsync(serverId, "/data", "*", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<DiscoveredFile>());

        // Act
        var result = await _controller.ListFiles(serverId, request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        _fileOpServiceMock.Verify(
            s => s.ListFilesAsync(serverId, "/data", "*", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task ListFiles_ServerNotFound_ReturnsNotFound()
    {
        // Arrange
        var serverId = "srv-notexist";
        var request = new ListFilesRequest { Path = "/data", Pattern = "*" };

        _fileOpServiceMock
            .Setup(s => s.ListFilesAsync(serverId, It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException("Server not found"));

        // Act
        var result = await _controller.ListFiles(serverId, request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task ListFiles_InvalidOperation_ReturnsBadRequest()
    {
        // Arrange
        var serverId = "srv-003";
        var request = new ListFilesRequest { Path = "/data", Pattern = "*" };

        _fileOpServiceMock
            .Setup(s => s.ListFilesAsync(serverId, It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Cannot list: connector not configured"));

        // Act
        var result = await _controller.ListFiles(serverId, request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "FileOperations")]
    public async Task ListFiles_UnexpectedException_Returns500()
    {
        // Arrange
        var serverId = "srv-004";
        var request = new ListFilesRequest { Path = "/data", Pattern = "*" };

        _fileOpServiceMock
            .Setup(s => s.ListFilesAsync(serverId, It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Network timeout"));

        // Act
        var result = await _controller.ListFiles(serverId, request);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task ListFiles_EmptyDirectory_ReturnsOkWithEmptyList()
    {
        // Arrange
        var serverId = "srv-005";
        var request = new ListFilesRequest { Path = "/empty", Pattern = "*.csv" };

        _fileOpServiceMock
            .Setup(s => s.ListFilesAsync(serverId, "/empty", "*.csv", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<DiscoveredFile>());

        // Act
        var result = await _controller.ListFiles(serverId, request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var files = okResult.Value.Should().BeAssignableTo<List<DiscoveredFile>>().Subject;
        files.Should().BeEmpty();
    }

    #endregion

    #region ReadFile Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task ReadFile_ValidPathAndServer_ReturnsFileContent()
    {
        // Arrange
        var serverId = "srv-010";
        var request = new ReadFileRequest { FilePath = "/data/imports/report.csv" };
        var fileContent = Encoding.UTF8.GetBytes("id,name,value\n1,Alice,100");

        _fileOpServiceMock
            .Setup(s => s.ReadFileAsync(serverId, request.FilePath, It.IsAny<CancellationToken>()))
            .ReturnsAsync(fileContent);

        // Act
        var result = await _controller.ReadFile(serverId, request);

        // Assert
        var fileResult = result.Should().BeOfType<FileContentResult>().Subject;
        fileResult.ContentType.Should().Be("application/octet-stream");
        fileResult.FileContents.Should().BeEquivalentTo(fileContent);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task ReadFile_EmptyFilePath_ReturnsBadRequest()
    {
        // Arrange
        var serverId = "srv-011";
        var request = new ReadFileRequest { FilePath = "" };

        // Act
        var result = await _controller.ReadFile(serverId, request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        _fileOpServiceMock.Verify(
            s => s.ReadFileAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task ReadFile_ServerNotFound_ReturnsNotFound()
    {
        // Arrange
        var serverId = "srv-gone";
        var request = new ReadFileRequest { FilePath = "/data/file.csv" };

        _fileOpServiceMock
            .Setup(s => s.ReadFileAsync(serverId, request.FilePath, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException("Server not found"));

        // Act
        var result = await _controller.ReadFile(serverId, request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task ReadFile_InvalidOperation_ReturnsBadRequest()
    {
        // Arrange
        var serverId = "srv-012";
        var request = new ReadFileRequest { FilePath = "/data/file.txt" };

        _fileOpServiceMock
            .Setup(s => s.ReadFileAsync(serverId, request.FilePath, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("File type not supported"));

        // Act
        var result = await _controller.ReadFile(serverId, request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    #endregion

    #region WriteFile Tests

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task WriteFile_ValidRequest_ReturnsOkWithSuccess()
    {
        // Arrange
        var serverId = "srv-020";
        var content = "id,name\n1,Test";
        var base64Content = Convert.ToBase64String(Encoding.UTF8.GetBytes(content));
        var request = new WriteFileRequest
        {
            FilePath = "/data/output/result.csv",
            Content = base64Content
        };

        _fileOpServiceMock
            .Setup(s => s.WriteFileAsync(serverId, request.FilePath, It.IsAny<byte[]>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _controller.WriteFile(serverId, request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        var response = okResult.Value.Should().BeAssignableTo<FileOperationResponse>().Subject;
        response.IsSuccess.Should().BeTrue();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task WriteFile_EmptyFilePath_ReturnsBadRequest()
    {
        // Arrange
        var serverId = "srv-021";
        var request = new WriteFileRequest
        {
            FilePath = "",
            Content = Convert.ToBase64String(new byte[] { 1, 2, 3 })
        };

        // Act
        var result = await _controller.WriteFile(serverId, request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
        _fileOpServiceMock.Verify(
            s => s.WriteFileAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<byte[]>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task WriteFile_EmptyContent_ReturnsBadRequest()
    {
        // Arrange
        var serverId = "srv-022";
        var request = new WriteFileRequest
        {
            FilePath = "/data/output/file.csv",
            Content = ""
        };

        // Act
        var result = await _controller.WriteFile(serverId, request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task WriteFile_InvalidBase64Content_ReturnsBadRequest()
    {
        // Arrange
        var serverId = "srv-023";
        var request = new WriteFileRequest
        {
            FilePath = "/data/output/file.csv",
            Content = "this-is-not-valid-base64!!!"
        };

        // Act
        var result = await _controller.WriteFile(serverId, request);

        // Assert
        result.Should().BeOfType<BadRequestObjectResult>();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task WriteFile_ServerNotFound_ReturnsNotFound()
    {
        // Arrange
        var serverId = "srv-noexist";
        var request = new WriteFileRequest
        {
            FilePath = "/data/output/file.csv",
            Content = Convert.ToBase64String(Encoding.UTF8.GetBytes("test"))
        };

        _fileOpServiceMock
            .Setup(s => s.WriteFileAsync(serverId, request.FilePath, It.IsAny<byte[]>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new KeyNotFoundException("Server not found"));

        // Act
        var result = await _controller.WriteFile(serverId, request);

        // Assert
        result.Should().BeOfType<NotFoundObjectResult>();
    }

    [Fact]
    [Trait("Priority", "P1")]
    [Trait("Area", "FileOperations")]
    public async Task WriteFile_WritesCorrectDecodedBytes()
    {
        // Arrange
        var serverId = "srv-024";
        var expectedContent = "hello,world\n1,2,3";
        var expectedBytes = Encoding.UTF8.GetBytes(expectedContent);
        var request = new WriteFileRequest
        {
            FilePath = "/data/output/hello.csv",
            Content = Convert.ToBase64String(expectedBytes)
        };

        byte[]? capturedBytes = null;
        _fileOpServiceMock
            .Setup(s => s.WriteFileAsync(serverId, request.FilePath, It.IsAny<byte[]>(), It.IsAny<CancellationToken>()))
            .Callback<string, string, byte[], CancellationToken>((_, _, bytes, _) => capturedBytes = bytes)
            .Returns(Task.CompletedTask);

        // Act
        await _controller.WriteFile(serverId, request);

        // Assert
        capturedBytes.Should().NotBeNull();
        capturedBytes.Should().BeEquivalentTo(expectedBytes);
    }

    [Fact]
    [Trait("Priority", "P2")]
    [Trait("Area", "FileOperations")]
    public async Task WriteFile_UnexpectedException_Returns500WithFailureResponse()
    {
        // Arrange
        var serverId = "srv-025";
        var request = new WriteFileRequest
        {
            FilePath = "/data/output/file.csv",
            Content = Convert.ToBase64String(Encoding.UTF8.GetBytes("data"))
        };

        _fileOpServiceMock
            .Setup(s => s.WriteFileAsync(serverId, request.FilePath, It.IsAny<byte[]>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Disk full"));

        // Act
        var result = await _controller.WriteFile(serverId, request);

        // Assert
        var statusResult = result.Should().BeOfType<ObjectResult>().Subject;
        statusResult.StatusCode.Should().Be(500);
        var response = statusResult.Value.Should().BeAssignableTo<FileOperationResponse>().Subject;
        response.IsSuccess.Should().BeFalse();
    }

    #endregion
}
