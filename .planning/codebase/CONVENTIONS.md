# Coding Conventions

**Analysis Date:** 2026-02-02

## Naming Patterns

**Files:**
- C# services: `[ServiceName]Service.cs` (e.g., `DataSourceService.cs`)
- C# interfaces: `I[Name].cs` (e.g., `IDataSourceService.cs`, `IDataSourceConnector.cs`)
- C# consumers: `[Entity]EventConsumer.cs` (e.g., `FileDiscoveredEventConsumer.cs`)
- C# controllers: `[EntityPlural]Controller.cs` (e.g., `DataSourceController.cs`)
- C# models: `[Name]Request.cs`, `[Name]Response.cs` (e.g., `CreateDataSourceRequest.cs`, `ApiResponse.cs`)
- React components: PascalCase with feature folder structure (e.g., `BasicInfoTab.tsx`, `DataSourceList.tsx`)
- React hooks: `use[Name]Hook.ts` or custom `use[Name].ts` pattern
- API clients: `[entity]-api-client.ts` (e.g., `connection-test-api-client.ts`, `categories-api-client.ts`)
- Test files: `[feature].spec.ts` for E2E tests (e.g., `datasource.spec.ts`, `metrics.spec.ts`)

**Functions (C#):**
- Public methods: PascalCase async suffix (e.g., `GetByIdAsync`, `CreateAsync`, `ProcessMessageAsync`)
- Private methods: PascalCase (e.g., `ValidateInput`, `MapToEntity`)
- Service methods always return `Task<T>` for async operations
- Async operations use `Async` suffix convention strictly

**Functions (TypeScript/React):**
- React components: PascalCase (e.g., `BasicInfoTab`, `DataSourceForm`)
- Custom hooks: `use` prefix in camelCase (e.g., `useDataSources`, `useQuery`)
- API functions: camelCase (e.g., `testKafkaConnection`, `getAllCategories`)
- Event handlers: `handle[Event]` pattern (e.g., `handleSplashFinish`, `handleSave`)
- Internal functions: camelCase (e.g., `mapDataSource`, `validateForm`)

**Variables:**
- C# properties: PascalCase (e.g., `Name`, `CorrelationId`, `IsSuccess`)
- C# private fields: `_camelCase` with underscore prefix (e.g., `_logger`, `_repository`, `_meter`)
- TypeScript interfaces: PascalCase (e.g., `DataSource`, `ApiResponse<T>`, `OutputConfiguration`)
- TypeScript constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- React state/props: camelCase (e.g., `isLoading`, `categories`, `form`)

**Types:**
- C# enums: PascalCase (e.g., `SortDirection`, `ConnectorType`)
- C# generic types: `T`, `TRequest`, `TResponse` for constraints
- TypeScript interfaces: `I` prefix not required (e.g., `DataSource`, not `IDataSource`)
- TypeScript unions: PascalCase with `|` (e.g., `'CSV' | 'Excel' | 'JSON' | 'XML'`)
- TypeScript optional properties: `prop?` suffix (e.g., `description?: string`)

## Code Style

**Formatting:**
- Languages: C# 10+ (ASP.NET Core), TypeScript 5+, React 19
- No explicit formatter specified; follows conventions from codebase
- C# uses default .NET naming conventions (PascalCase properties, camelCase parameters)
- TypeScript uses standard camelCase/PascalCase split

**Linting:**
- Frontend: ESLint with `eslint-config-react-app` and `react-app/jest` preset
- Configuration: `package.json` eslintConfig section (src/Frontend/package.json lines 49-53)
- Run: `npm run lint` or `npm run lint:fix`
- No `.eslintrc` file in root; using inline config

**Build configuration:**
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json` (line 17)
- No `allowImplicitAny`; all types must be explicit
- Module resolution: `bundler` with ESNext modules

## Import Organization

**Order (C#):**
1. System namespaces (`using System;`, `using System.Diagnostics;`)
2. Third-party namespaces (`using MongoDB.Entities;`, `using MassTransit;`)
3. Custom DataProcessing namespaces (`using DataProcessing.Shared.*;`)
4. Blank line separator

Example from `DataSourceService.cs` (lines 1-12):
```csharp
using System.Diagnostics;
using Microsoft.Extensions.Logging;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Shared.Messages;
using DataProcessing.DataSourceManagement.Models.Requests;
```

**Order (TypeScript):**
1. React/library imports (`import React from 'react'`)
2. Third-party UI/utility imports (`import { Form, Input, Select } from 'antd'`)
3. Custom imports (`import { getAllCategories } from '../../../services/'`)
4. Blank line separator

Example from `BasicInfoTab.tsx` (lines 1-9):
```typescript
import React from 'react';
import { Form, Input, Select, Switch, InputNumber, Row, Col, Alert, Spin } from 'antd';
import { FormInstance } from 'antd/es/form';
import { useQuery } from '@tanstack/react-query';
import { getAllCategories } from '../../../services/categories-api-client';
```

**Path Aliases:**
- No path aliases configured in frontend `tsconfig.json`
- Use relative paths: `../../../services/` for navigation
- Vite handles path resolution via `vite-tsconfig-paths` plugin

## Error Handling

**Patterns (C#):**
- Service methods return `ApiResponse<T>` wrapper (see `src/Services/DataSourceManagementService/Models/Responses/ApiResponse.cs`)
- Success/failure indicated by `IsSuccess` property (line 30)
- Errors wrapped in `ErrorDetail` object with code, message, status code
- Hebrew error messages via `HebrewErrorResponseFactory` (line 78 in `DataSourceService.cs`)
- Logging includes correlation ID for tracing: `_logger.LogError(ex, "message {CorrelationId}", correlationId)`
- Controller methods return `StatusCode(result.Error!.StatusCode, ErrorResponse.Create(...))`

**Pattern (C# Exception Handling):**
```csharp
try
{
    var result = await _repository.GetByIdAsync(id);
    if (result == null)
    {
        var errorResponse = HebrewErrorResponseFactory.CreateNotFoundError(correlationId, "data_source", id);
        return ApiResponse<T>.Failure(errorResponse.Error, correlationId);
    }
    return ApiResponse<T>.Success(result, correlationId);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Error message {CorrelationId}", correlationId);
    var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
    return ApiResponse<T>.Failure(errorResponse.Error, correlationId);
}
```

**Patterns (TypeScript/React):**
- API client functions use try-catch with axios error handling (line 49-75 in `connection-test-api-client.ts`)
- Return error details in same response object as success: `{ success: false, message: string, errorDetails?: string }`
- Components handle async data with `useQuery` from React Query (TanStack)
- Error display via Ant Design `Alert` component (see `BasicInfoTab.tsx` lines 68-74)
- Form validation via Ant Design Form rules: `{ required: true, message: 'error text' }`

**Validation Patterns:**
- Input validation in Form rules with `min`, `max`, `required` (lines 30-34 in `BasicInfoTab.tsx`)
- C# service validation returns `CreateValidationError` before processing
- Correlation ID validation: check not empty/null before processing

## Logging

**Framework (C#):** `Serilog` with structured logging
- Configuration: `src/Services/Shared/Configuration/LoggingConfiguration.cs` (lines 21-165)
- Console sink: `[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}` format (line 74)
- File sink: rolling daily with 30-day retention (lines 81-87)
- Elasticsearch integration for production (lines 91-108)
- Enrichers: CorrelationId, MachineName, Service name, Version

**Patterns:**
- Information level: successful operations (lines 59, 70)
- Warning level: expected failures, e.g., resource not found (lines 54, 65)
- Error level: unexpected exceptions with full context (line 77)
- Structured logging with named parameters: `{CorrelationId}`, `{Message:lj}`

**Framework (TypeScript):** `console` (no structured logger)
- No production logging setup in frontend code
- Comments mark debugging statements

**Context Enrichment:**
- Correlation ID passed through all methods: `correlationId` parameter
- Activity tags for OpenTelemetry: `activity?.SetTag("correlation-id", correlationId)`
- AsyncLocal context via `CallContext` for cross-boundary tracing

## Comments

**When to Comment:**
- Explain "why" not "what" (code shows what, comments explain intent)
- Complex algorithms or non-obvious logic
- Workarounds for platform-specific issues
- Integration with external systems (e.g., MongoDB connection strings)

**JSDoc/XML Documentation:**
- C# uses XML doc comments on all public types/members (e.g., lines 5-10 in `IDataSourceConnector.cs`)
- Triple-slash format: `/// <summary>` (lines 5-7, 10-12, etc.)
- Include `<param>`, `<returns>`, `<response>` tags for full documentation
- TypeScript: Inline comments, no JSDoc convention observed

**Example (C#):**
```csharp
/// <summary>
/// Reads a file from the data source and returns it as a stream
/// </summary>
/// <param name="dataSource">Data source configuration</param>
/// <param name="filePath">Path to the specific file to read</param>
/// <param name="cancellationToken">Cancellation token</param>
/// <returns>Stream containing the file content</returns>
Task<Stream> ReadFileAsync(
    DataProcessingDataSource dataSource,
    string filePath,
    CancellationToken cancellationToken = default);
```

## Function Design

**Size:**
- C# service methods: 20-50 lines typical (lines 43-81 in `DataSourceService.GetByIdAsync`)
- Complex operations break into private helpers
- Controllers delegate to services (lines 47-66 in `DataSourceController.GetById`)

**Parameters:**
- C#: explicit parameters, minimal null coalescing
- Always include `CancellationToken cancellationToken = default` for async methods (lines 22-25 in `IDataSourceConnector.cs`)
- TypeScript API functions: single request object for complex inputs (e.g., `KafkaTestRequest`)

**Return Values:**
- C# services: always wrapped in `ApiResponse<T>` for consistency
- C# consumers: `Task` with side effects (no return value)
- TypeScript: Promise<T> with success/error in same object or throw on connection errors

**Observable Behavior:**
- Methods produce side effects: logging, metrics recording, event publishing
- Consumers record metrics counters and duration histograms (lines 88, 109 in `DataProcessingConsumerBase.cs`)
- No pure functions for business logic; all have observable effects

## Module Design

**Exports (C#):**
- Services exported as interfaces: `IDataSourceService` (lines 20-26 in `DataSourceService.cs`)
- Controllers register routes via `[Route("api/v1/[controller]")]` attribute
- Database entities inherit from `DataProcessingBaseEntity` for consistency

**Exports (TypeScript):**
- React components: named export `export const ComponentName = (...) => { ... }`
- API clients: named exports for each function (e.g., `export const testKafkaConnection`, line 46)
- Types: named exports from `types.ts` files (e.g., `export interface DataSource`)

**Barrel Files:**
- Not explicitly used in frontend
- Service imports are direct: `import { getAllCategories } from '../../../services/categories-api-client'`

**Module Organization:**
- Feature-based folders: `datasource/`, `metrics/`, `schema/`
- Shared utilities in `services/`, `utils/`, `types/`
- Config files at root: `playwright.config.ts`, `tsconfig.json`, `vite.config.ts`

## Async/Await Patterns

**C# async (all service/consumer methods):**
- Every async method ends with `Async` suffix
- Always `await` on async operations
- Use `CancellationToken` for cancellation support
- Pattern: `async Task<T>` for methods returning value, `async Task` for side effects only

**TypeScript async:**
- React Query `useQuery` for data fetching (lines 18-21 in `BasicInfoTab.tsx`)
- Axios with async/await in API clients (lines 46-76 in `connection-test-api-client.ts`)
- Error handling in try-catch blocks

## Naming Conventions Summary

| Construct | Pattern | Example |
|-----------|---------|---------|
| C# class | PascalCase | `DataSourceService` |
| C# interface | IPascalCase | `IDataSourceRepository` |
| C# public method | PascalCaseAsync | `GetByIdAsync` |
| C# private field | _camelCase | `_logger` |
| C# property | PascalCase | `CorrelationId`, `IsSuccess` |
| C# enum | PascalCase | `SortDirection` |
| TypeScript interface | PascalCase | `DataSource` |
| React component | PascalCase | `BasicInfoTab` |
| React hook | useCamelCase | `useQuery`, `useDataSources` |
| TypeScript function | camelCase | `getAllCategories` |
| TypeScript constant | UPPER_SNAKE_CASE | `API_BASE_URL` |
| TypeScript variable | camelCase | `isLoading`, `categories` |
| File (C# service) | ServiceName.cs | `DataSourceService.cs` |
| File (React) | ComponentName.tsx | `BasicInfoTab.tsx` |
| File (API client) | entity-api-client.ts | `connection-test-api-client.ts` |

---

*Convention analysis: 2026-02-02*
