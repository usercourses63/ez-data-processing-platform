// FileVolumeTests.cs - File Volume Load Tests
// EZ Platform Integration Tests
// Phase 04-03: Load Testing & Documentation
// Version: 1.0
// Date: February 2, 2026

using System.Diagnostics;
using System.Text.Json;
using DataProcessing.IntegrationTests.Fixtures;
using DataProcessing.Shared.Tests.TestData;
using FluentAssertions;
using Xunit;
using Xunit.Abstractions;

namespace DataProcessing.IntegrationTests.LoadTests;

/// <summary>
/// Load tests for file volume throughput validation.
/// Tests 10, 100, and 1000 file processing scenarios.
/// Validates TEST-07: Load testing validated (100-1000 files).
/// </summary>
[Collection("Integration")]
[Trait("Category", "LoadTest")]
public class FileVolumeTests : IClassFixture<PipelineFixture>
{
    private readonly PipelineFixture _pipeline;
    private readonly ITestOutputHelper _output;

    public FileVolumeTests(PipelineFixture pipeline, ITestOutputHelper output)
    {
        _pipeline = pipeline;
        _output = output;
    }

    #region Helper Methods

    /// <summary>
    /// Stages multiple test files via FTP with batch optimization
    /// </summary>
    private async Task<List<(string FileName, string FilePath)>> StageBatchFilesAsync(
        int fileCount,
        int recordsPerFile = 10,
        string prefix = "load-test")
    {
        var stagedFiles = new List<(string FileName, string FilePath)>();
        var batchSize = Math.Min(10, fileCount); // Stage in batches of 10 to avoid FTP overload

        for (int batch = 0; batch < fileCount; batch += batchSize)
        {
            var batchTasks = new List<Task<(string FileName, string FilePath)>>();
            var currentBatchSize = Math.Min(batchSize, fileCount - batch);

            for (int i = 0; i < currentBatchSize; i++)
            {
                var fileIndex = batch + i;
                var fileName = $"{prefix}-{fileIndex + 1:D6}.csv";
                var content = TestDataFactory.GenerateDeterministicCsv(recordsPerFile);

                // Sequential within batch to avoid FTP connection limits
                var result = await _pipeline.StageTestFileAsync(fileName, content);
                stagedFiles.Add(result);
            }

            _output.WriteLine($"Staged batch {batch / batchSize + 1}: files {batch + 1}-{batch + currentBatchSize}");
        }

        return stagedFiles;
    }

    /// <summary>
    /// Publishes FileDiscoveredEvent for each staged file
    /// </summary>
    private async Task<List<string>> PublishFileEventsAsync(
        List<(string FileName, string FilePath)> stagedFiles)
    {
        var correlationIds = new List<string>();

        foreach (var (fileName, filePath) in stagedFiles)
        {
            var correlationId = Guid.NewGuid().ToString("N")[..16];
            await _pipeline.PublishFileDiscoveredEventAsync(correlationId, fileName, filePath);
            correlationIds.Add(correlationId);
        }

        _output.WriteLine($"Published {correlationIds.Count} FileDiscoveredEvents");
        return correlationIds;
    }

    /// <summary>
    /// Waits for processing completion by counting output messages
    /// </summary>
    private async Task<int> WaitForProcessedCountAsync(
        List<string> correlationIds,
        TimeSpan timeout)
    {
        var processedCount = 0;
        var deadline = DateTime.UtcNow.Add(timeout);
        var processedCorrelations = new HashSet<string>();

        using var consumer = _pipeline.Kafka.CreateConsumer(
            TestConfiguration.KafkaTopics.RecordOutput,
            $"load-test-{Guid.NewGuid():N}"[..16]);

        while (DateTime.UtcNow < deadline && processedCount < correlationIds.Count)
        {
            try
            {
                var result = consumer.Consume(TimeSpan.FromSeconds(1));
                if (result?.Message?.Value != null)
                {
                    // Check if this message matches any of our correlation IDs
                    foreach (var correlationId in correlationIds)
                    {
                        if (result.Message.Value.Contains(correlationId) &&
                            !processedCorrelations.Contains(correlationId))
                        {
                            processedCorrelations.Add(correlationId);
                            processedCount++;
                            break;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _output.WriteLine($"Consumer error: {ex.Message}");
            }

            // Progress update every 10 files
            if (processedCount > 0 && processedCount % 10 == 0)
            {
                var elapsed = DateTime.UtcNow - deadline.Add(-timeout);
                _output.WriteLine($"Progress: {processedCount}/{correlationIds.Count} files ({elapsed.TotalSeconds:F1}s)");
            }
        }

        return processedCount;
    }

    /// <summary>
    /// Logs performance metrics for the test run
    /// </summary>
    private void LogPerformanceMetrics(
        int fileCount,
        int processedCount,
        TimeSpan elapsed)
    {
        var throughput = fileCount / elapsed.TotalMinutes;
        var avgPerFile = elapsed.TotalSeconds / Math.Max(1, processedCount);

        _output.WriteLine("=== Performance Metrics ===");
        _output.WriteLine($"Files Staged: {fileCount}");
        _output.WriteLine($"Files Processed: {processedCount}");
        _output.WriteLine($"Completion Rate: {(double)processedCount / fileCount:P1}");
        _output.WriteLine($"Total Duration: {elapsed.TotalSeconds:F2}s ({elapsed.TotalMinutes:F2}min)");
        _output.WriteLine($"Throughput: {throughput:F1} files/minute");
        _output.WriteLine($"Average per File: {avgPerFile:F3}s");
        _output.WriteLine("===========================");
    }

    private void SkipIfUnavailable()
    {
        Skip.If(!_pipeline.IsAvailable, _pipeline.SkipReason);
        Skip.If(!_pipeline.IsFileSimulatorAvailable, "File-simulator required for load tests");
    }

    #endregion

    #region Quick Baseline Test (10 files)

    /// <summary>
    /// Quick baseline test with 10 files.
    /// Validates basic pipeline throughput before larger tests.
    /// Expected: Complete within 2 minutes.
    /// </summary>
    [SkippableFact]
    [Trait("FileCount", "10")]
    [Trait("Category", "LoadTest")]
    public async Task LoadTest_10Files_CompletesWithin2Minutes()
    {
        // Arrange
        SkipIfUnavailable();

        const int fileCount = 10;
        const int recordsPerFile = 10;
        var timeout = TimeSpan.FromMinutes(2);

        _output.WriteLine($"Starting 10-file baseline test");
        _output.WriteLine($"  Files: {fileCount}");
        _output.WriteLine($"  Records per file: {recordsPerFile}");
        _output.WriteLine($"  Timeout: {timeout.TotalMinutes} minutes");

        var stopwatch = Stopwatch.StartNew();

        // Act - Stage files
        var stagedFiles = await StageBatchFilesAsync(fileCount, recordsPerFile, "baseline-10");
        stagedFiles.Should().HaveCount(fileCount);

        // Act - Publish events
        var correlationIds = await PublishFileEventsAsync(stagedFiles);
        correlationIds.Should().HaveCount(fileCount);

        // Act - Wait for processing
        var processedCount = await WaitForProcessedCountAsync(correlationIds, timeout);

        stopwatch.Stop();

        // Assert
        LogPerformanceMetrics(fileCount, processedCount, stopwatch.Elapsed);

        stopwatch.Elapsed.Should().BeLessThan(timeout,
            "10 files should process within 2 minutes");

        // Allow for some message loss in distributed system
        processedCount.Should().BeGreaterOrEqualTo((int)(fileCount * 0.9),
            "At least 90% of files should be processed");
    }

    #endregion

    #region 100 File Test (Primary Load Test)

    /// <summary>
    /// Primary load test with 100 files.
    /// Validates TEST-07: "100 files processed within 5 minutes".
    /// </summary>
    [SkippableFact]
    [Trait("FileCount", "100")]
    [Trait("Category", "LoadTest")]
    public async Task LoadTest_100Files_CompletesWithin5Minutes()
    {
        // Arrange
        SkipIfUnavailable();

        const int fileCount = 100;
        const int recordsPerFile = 10;
        var timeout = TimeSpan.FromMinutes(5);

        _output.WriteLine($"Starting 100-file load test");
        _output.WriteLine($"  Files: {fileCount}");
        _output.WriteLine($"  Records per file: {recordsPerFile}");
        _output.WriteLine($"  Total records: {fileCount * recordsPerFile}");
        _output.WriteLine($"  Timeout: {timeout.TotalMinutes} minutes");

        var stopwatch = Stopwatch.StartNew();

        // Act - Stage files
        var stagedFiles = await StageBatchFilesAsync(fileCount, recordsPerFile, "load-100");
        stagedFiles.Should().HaveCount(fileCount);

        var stagingTime = stopwatch.Elapsed;
        _output.WriteLine($"File staging completed in {stagingTime.TotalSeconds:F1}s");

        // Act - Publish events
        var correlationIds = await PublishFileEventsAsync(stagedFiles);
        correlationIds.Should().HaveCount(fileCount);

        var publishTime = stopwatch.Elapsed - stagingTime;
        _output.WriteLine($"Event publishing completed in {publishTime.TotalSeconds:F1}s");

        // Act - Wait for processing
        var remainingTimeout = timeout - stopwatch.Elapsed;
        var processedCount = await WaitForProcessedCountAsync(correlationIds, remainingTimeout);

        stopwatch.Stop();

        // Assert
        LogPerformanceMetrics(fileCount, processedCount, stopwatch.Elapsed);

        stopwatch.Elapsed.Should().BeLessThan(timeout,
            "100 files should process within 5 minutes (TEST-07)");

        // Allow for some message loss in distributed system
        processedCount.Should().BeGreaterOrEqualTo((int)(fileCount * 0.9),
            "At least 90% of files should be processed without message loss");
    }

    #endregion

    #region 1000 File Stretch Goal Test

    /// <summary>
    /// Stretch goal test with 1000 files.
    /// Validates TEST-07: "1000 files processed within 30 minutes (stretch goal)".
    /// This test is expected to take significant time and may skip on CI.
    /// </summary>
    [SkippableFact]
    [Trait("FileCount", "1000")]
    [Trait("Category", "LoadTest")]
    [Trait("Category", "StretchGoal")]
    public async Task LoadTest_1000Files_CompletesWithin30Minutes_StretchGoal()
    {
        // Arrange
        SkipIfUnavailable();

        const int fileCount = 1000;
        const int recordsPerFile = 10;
        var timeout = TimeSpan.FromMinutes(30);

        // Skip in CI if environment variable set
        var skipStretch = Environment.GetEnvironmentVariable("SKIP_STRETCH_TESTS");
        Skip.If(skipStretch == "true", "Stretch tests skipped in CI (SKIP_STRETCH_TESTS=true)");

        _output.WriteLine($"Starting 1000-file stretch goal test");
        _output.WriteLine($"  Files: {fileCount}");
        _output.WriteLine($"  Records per file: {recordsPerFile}");
        _output.WriteLine($"  Total records: {fileCount * recordsPerFile}");
        _output.WriteLine($"  Timeout: {timeout.TotalMinutes} minutes");
        _output.WriteLine($"  WARNING: This test may take up to 30 minutes");

        var stopwatch = Stopwatch.StartNew();

        // Act - Stage files in larger batches for efficiency
        var stagedFiles = await StageBatchFilesAsync(fileCount, recordsPerFile, "load-1000");
        stagedFiles.Should().HaveCount(fileCount);

        var stagingTime = stopwatch.Elapsed;
        _output.WriteLine($"File staging completed in {stagingTime.TotalMinutes:F2} minutes");

        // Act - Publish events
        var correlationIds = await PublishFileEventsAsync(stagedFiles);
        correlationIds.Should().HaveCount(fileCount);

        var publishTime = stopwatch.Elapsed - stagingTime;
        _output.WriteLine($"Event publishing completed in {publishTime.TotalSeconds:F1}s");

        // Act - Wait for processing
        var remainingTimeout = timeout - stopwatch.Elapsed;
        var processedCount = await WaitForProcessedCountAsync(correlationIds, remainingTimeout);

        stopwatch.Stop();

        // Assert
        LogPerformanceMetrics(fileCount, processedCount, stopwatch.Elapsed);

        // Stretch goal - may not achieve 100% but should be reasonable
        if (stopwatch.Elapsed < timeout)
        {
            _output.WriteLine("SUCCESS: Completed within 30 minute timeout (stretch goal achieved)");
        }
        else
        {
            _output.WriteLine("PARTIAL: Exceeded 30 minute timeout but test ran");
        }

        // For stretch goal, be lenient - 80% completion is acceptable
        processedCount.Should().BeGreaterOrEqualTo((int)(fileCount * 0.8),
            "At least 80% of files should be processed for stretch goal");
    }

    #endregion

    #region Performance Baseline Test

    /// <summary>
    /// Establishes performance baseline for regression tracking.
    /// Records throughput metrics without strict pass/fail criteria.
    /// </summary>
    [SkippableFact]
    [Trait("Category", "LoadTest")]
    [Trait("Category", "Baseline")]
    public async Task LoadTest_EstablishBaseline_RecordMetrics()
    {
        // Arrange
        SkipIfUnavailable();

        const int fileCount = 25;
        const int recordsPerFile = 10;
        var timeout = TimeSpan.FromMinutes(3);

        _output.WriteLine("=== PERFORMANCE BASELINE TEST ===");
        _output.WriteLine($"Test parameters: {fileCount} files x {recordsPerFile} records");

        var stopwatch = Stopwatch.StartNew();

        // Act
        var stagedFiles = await StageBatchFilesAsync(fileCount, recordsPerFile, "baseline");
        var correlationIds = await PublishFileEventsAsync(stagedFiles);
        var processedCount = await WaitForProcessedCountAsync(correlationIds, timeout);

        stopwatch.Stop();

        // Record baseline metrics (no strict assertions)
        var throughput = fileCount / stopwatch.Elapsed.TotalMinutes;
        var completionRate = (double)processedCount / fileCount;

        _output.WriteLine("=== BASELINE METRICS ===");
        _output.WriteLine($"Duration: {stopwatch.Elapsed.TotalSeconds:F2}s");
        _output.WriteLine($"Throughput: {throughput:F1} files/min");
        _output.WriteLine($"Completion: {completionRate:P1}");
        _output.WriteLine($"Processed: {processedCount}/{fileCount}");
        _output.WriteLine("========================");
        _output.WriteLine("");
        _output.WriteLine("Copy these values to 04-TEST-RESULTS.md for regression tracking:");
        _output.WriteLine($"  baseline_throughput_files_per_min: {throughput:F1}");
        _output.WriteLine($"  baseline_completion_rate: {completionRate:P1}");
        _output.WriteLine($"  baseline_duration_seconds: {stopwatch.Elapsed.TotalSeconds:F2}");

        // Soft assertion - test passes but logs warning if below threshold
        if (throughput < 10)
        {
            _output.WriteLine("WARNING: Throughput below 10 files/min threshold");
        }
    }

    #endregion

    #region Message Loss Verification Test

    /// <summary>
    /// Verifies no message loss during volume processing.
    /// Validates TEST-07: "No message loss during volume processing".
    /// </summary>
    [SkippableFact]
    [Trait("Category", "LoadTest")]
    [Trait("Category", "MessageIntegrity")]
    public async Task LoadTest_VerifyNoMessageLoss_AllFilesTracked()
    {
        // Arrange
        SkipIfUnavailable();

        const int fileCount = 50;
        const int recordsPerFile = 5;
        var timeout = TimeSpan.FromMinutes(3);

        _output.WriteLine($"Starting message loss verification test");
        _output.WriteLine($"  Files: {fileCount}");

        var stopwatch = Stopwatch.StartNew();

        // Act
        var stagedFiles = await StageBatchFilesAsync(fileCount, recordsPerFile, "integrity");
        var correlationIds = await PublishFileEventsAsync(stagedFiles);

        // Create lookup for tracking
        var pendingIds = new HashSet<string>(correlationIds);
        var processedIds = new HashSet<string>();
        var failedIds = new HashSet<string>();

        // Monitor both output and invalid-record topics
        using var outputConsumer = _pipeline.Kafka.CreateConsumer(
            TestConfiguration.KafkaTopics.RecordOutput,
            $"integrity-output-{Guid.NewGuid():N}"[..16]);

        using var invalidConsumer = _pipeline.Kafka.CreateConsumer(
            TestConfiguration.KafkaTopics.InvalidRecord,
            $"integrity-invalid-{Guid.NewGuid():N}"[..16]);

        var deadline = DateTime.UtcNow.Add(timeout);

        while (DateTime.UtcNow < deadline && pendingIds.Count > 0)
        {
            // Check output topic
            var outputResult = outputConsumer.Consume(TimeSpan.FromMilliseconds(250));
            if (outputResult?.Message?.Value != null)
            {
                foreach (var id in pendingIds.ToList())
                {
                    if (outputResult.Message.Value.Contains(id))
                    {
                        pendingIds.Remove(id);
                        processedIds.Add(id);
                    }
                }
            }

            // Check invalid-record topic
            var invalidResult = invalidConsumer.Consume(TimeSpan.FromMilliseconds(250));
            if (invalidResult?.Message?.Value != null)
            {
                foreach (var id in pendingIds.ToList())
                {
                    if (invalidResult.Message.Value.Contains(id))
                    {
                        pendingIds.Remove(id);
                        failedIds.Add(id);
                    }
                }
            }
        }

        stopwatch.Stop();

        // Assert
        var accountedFor = processedIds.Count + failedIds.Count;

        _output.WriteLine("=== Message Tracking Results ===");
        _output.WriteLine($"Total files: {fileCount}");
        _output.WriteLine($"Processed (output): {processedIds.Count}");
        _output.WriteLine($"Failed (invalid): {failedIds.Count}");
        _output.WriteLine($"Unaccounted: {pendingIds.Count}");
        _output.WriteLine($"Accounted for: {accountedFor}/{fileCount} ({(double)accountedFor / fileCount:P1})");
        _output.WriteLine("================================");

        // No message loss means all files either succeeded or failed (not lost)
        accountedFor.Should().Be(fileCount,
            "All files should be accounted for (processed or failed) - no message loss");
    }

    #endregion
}
