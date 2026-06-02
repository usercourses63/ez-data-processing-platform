# Deferred Items — Phase 34

Out-of-scope discoveries logged during execution (not fixed; outside the current plan's scope).

## 34-01

### Pre-existing CategoriesControllerTests failures (SignalR mocks)
- **Files:** `tests/DataSourceManagement.Tests/Controllers/CategoriesControllerTests.cs`
- **Failing tests (5):** `Create_ValidRequest_Returns201CreatedAtAction`,
  `ToggleActive_ExistingCategory_ReturnsOkWithUpdatedCategory`, `Reorder_ValidRequest_ReturnsOk`,
  `Delete_ExistingCategory_ReturnsNoContent`, `Update_ExistingCategory_ReturnsOkWithUpdatedCategory`
- **Cause:** `CategoriesController` CRUD methods broadcast via `_hubContext.Clients.All.SendAsync(...)`
  (SignalR mandate added in an earlier phase). The tests mock `IHubContext<MonitoringHub>` but do
  not stub the `Clients.All` / `IClientProxy` chain, so `SendAsync` throws NRE → controller's
  catch returns a 500 `ObjectResult` instead of the expected `CreatedAtActionResult`/`OkObjectResult`/etc.
- **Why deferred:** Pre-existing test rot unrelated to Phase 34's S3 credential work. Task 34-01's
  verification gate is `dotnet build src/Services/DataSourceManagementService` (passes). Properly
  fixing requires stubbing the full SignalR client-proxy chain across 5 tests — out of plan scope.
- **Note:** 34-01 only minimally repaired the *compilation* of these tests (ctor signature drift +
  renamed `DiscoveredFile.FilePath`→`FullPath`) so the test assembly builds and the Phase-34 tests run.
  The behavioral SignalR-mock gap remains for a future test-maintenance pass.
