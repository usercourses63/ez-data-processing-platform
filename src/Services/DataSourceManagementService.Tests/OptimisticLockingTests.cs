using Xunit;

namespace DataProcessing.DataSourceManagement.Tests;

/// <summary>
/// Integration tests for optimistic locking (Version field, 409 Conflict).
/// Stubs created as part of Plan 22-03 — implement when test infrastructure is ready.
/// </summary>
public class OptimisticLockingTests
{
    [Fact(Skip = "Stub -- implement with WebApplicationFactory")]
    public async Task Update_WithStaleVersion_Returns409Conflict()
    {
        // TODO: Create DataSource, read Version, update to increment Version,
        // then PUT with original (stale) Version — expect 409
        await Task.CompletedTask;
        Assert.True(false, "Not implemented");
    }

    [Fact(Skip = "Stub -- implement with WebApplicationFactory")]
    public async Task Update_WithCurrentVersion_Returns200OK()
    {
        // TODO: Create DataSource, read Version, PUT with matching Version — expect 200
        await Task.CompletedTask;
        Assert.True(false, "Not implemented");
    }
}
