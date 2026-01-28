# Coding Conventions

**Analysis Date:** 2026-01-28

## Naming Patterns

**Files:**
- Frontend components: PascalCase with `.tsx` extension (e.g., `DataTable.tsx`, `ErrorBoundary.tsx`)
- Frontend utilities: camelCase with `.ts` extension (e.g., `schemaValidator.ts`, `validationErrorTranslator.ts`)
- Frontend services: kebab-case with `-api-client.ts` suffix (e.g., `invalidrecords-api-client.ts`, `metrics-api-client.ts`)
- Backend services: PascalCase with `.cs` extension (e.g., `DataSourceService.cs`, `CategoryService.cs`)
- Backend interfaces: PascalCase with `I` prefix (e.g., `IDataSourceService.cs`, `IConnectionTestService.cs`)
- Backend controllers: PascalCase with `Controller` suffix (e.g., `DataSourceController.cs`)
- Test files (Backend): PascalCase with `.cs` extension (e.g., `JsonSchemaValidationTests.cs`)
- Test files (Frontend): kebab-case with `.spec.ts` suffix (e.g., `datasource.spec.ts`, `alerts.spec.ts`)

**Functions:**
- Frontend: camelCase (e.g., `handleTableChange`, `unreverseRTLPattern`, `fixRTLPatterns`)
- Backend public methods: PascalCase (e.g., `GetByIdAsync`, `GetPagedAsync`, `CreateAsync`)
- Backend private methods: camelCase (e.g., `_validateInput`, `_enrichMetrics`)
- Event handlers: camelCase with `handle` prefix (e.g., `handlePaginationChange`, `handleSort`)
- Async operations: end with `Async` suffix (e.g., `GetByIdAsync`, `CreateDatasourceAsync`)

**Variables:**
- Frontend: camelCase (e.g., `isHebrew`, `uniqueId`, `testMessage`)
- Backend: camelCase (e.g., `correlationId`, `dataSource`, `errorResponse`)
- Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `DEFAULT_TIMEOUT`)
- React state setters: `set` prefix followed by camelCase (e.g., `setLoading`, `setError`)

**Types:**
- Backend interfaces: `I` prefix (e.g., `IDataSourceService`, `IConnectionTestService`)
- Backend records/models: PascalCase suffix with type (e.g., `DataSourceRequest`, `ApiResponse<T>`)
- Frontend interfaces: PascalCase (e.g., `PaginationConfig`, `DataTableProps<T>`)
- Frontend type aliases: PascalCase (e.g., `ValidationResult`, `ValidationError`)
- Generics: Single letter uppercase (e.g., `<T>`, `<TResponse>`)

**Namespaces/Modules:**
- Backend: `DataProcessing.[ServiceArea]` (e.g., `DataProcessing.DataSourceManagement`, `DataProcessing.Validation`)
- Backend test namespaces: `DataProcessing.[ServiceArea].Tests` (e.g., `DataProcessing.Validation.Tests`)
- Frontend: directory-based organization with barrel files (e.g., `src/services/`, `src/components/`)

## Code Style

**Formatting:**
- Frontend: Vite + React with TypeScript 5.9.3
- Backend: .NET 10.0 with C# latest features
- Line width: No strict enforced limit (observed: varies 80-120 chars)
- Indentation: 2 spaces (Frontend), 4 spaces (Backend)
- Semicolons: Required in TypeScript (explicit)

**Linting:**
- Frontend: ESLint with react-app config
  - Config: `eslintConfig` in `package.json` extends `react-app` and `react-app/jest`
  - Command: `npm run lint` and `npm run lint:fix`
  - File patterns: `.ts`, `.tsx` files
- Backend: No explicit linter configured; relies on C# conventions and code review

**EditorConfig:**
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json`
- No fallthrough cases: `"noFallthroughCasesInSwitch": true`
- Resolve JSON modules: Enabled for importing JSON configs

## Import Organization

**Order (Frontend TypeScript):**
1. External libraries/packages (React, Ant Design, utilities)
2. Internal services (API clients, utilities)
3. Internal components
4. Local utilities/types
5. Styles (CSS imports)

**Example pattern from `src/Frontend/src/components/shared/DataTable.tsx`:**
```typescript
import React from 'react';
import { Table, Space, Empty } from 'antd';
import type { ColumnType, TablePaginationConfig, SorterResult, FilterValue } from 'antd/es/table/interface';
import { useTranslation } from 'react-i18next';
// ... local utilities follow
```

**Path Aliases:**
- Frontend: Configured via `vite-tsconfig-paths` plugin
- Relative imports: Used consistently (`../services`, `../../utils`)

**Order (Backend C#):**
1. System namespaces
2. Microsoft namespaces
3. External package namespaces
4. DataProcessing namespaces (organized by layer)

**Example pattern from `DataSourceService.cs`:**
```csharp
using System.Diagnostics;
using Microsoft.Extensions.Logging;
using DataProcessing.Shared.Entities;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Repositories;
// ... more specific imports follow
```

## Error Handling

**Frontend Patterns:**
- Try-catch blocks with user-friendly error messages
- Error boundary component wraps UI sections: `<ErrorBoundary>`
- API response validation with `isSuccess` flag
- Error state managed in React hooks or component state
- Hebrew error message translation via `i18next`

**Example from `invalidrecords-api-client.ts`:**
```typescript
try {
  const response = await fetch(url, { ...options });
  const data = await response.json();
  // validation and error handling
} catch (error) {
  // Handle error
}
```

**Backend Patterns:**
- Service methods return `ApiResponse<T>` wrapper with `IsSuccess` flag
- Try-catch blocks with structured logging and correlation ID
- Custom error factories: `HebrewErrorResponseFactory` for user messages
- Activity tracing with correlation ID propagation
- Metric counters for failure tracking

**Example from `DataSourceService.cs`:**
```csharp
try {
  // Business logic
} catch (Exception ex) {
  _logger.LogError(ex, "Error message with context. CorrelationId: {CorrelationId}", correlationId);
  var errorResponse = HebrewErrorResponseFactory.CreateDatabaseError(correlationId, ex.Message);
  return ApiResponse<T>.Failure(errorResponse.Error, correlationId);
}
```

## Logging

**Framework:**
- Frontend: `console` object (console.error, console.log in error boundaries)
- Backend: Serilog with structured logging configuration

**Patterns (Frontend):**
- Error boundary logs to console: `console.error('ErrorBoundary caught error:', error, errorInfo)`
- No production logging middleware; errors go to console for debugging

**Patterns (Backend - from `LoggingConfiguration.cs`):**
- Service level: `_logger.LogInformation()`, `_logger.LogWarning()`, `_logger.LogError()`
- Structured properties: Include `CorrelationId`, service name, timestamp
- Log enrichment: Thread ID, machine name, environment, application version
- Output targets: Console, file, Elasticsearch
- Elasticsearch integration via `Elastic.Serilog.Sinks`

**Logging format (Serilog console output):**
```
[HH:mm:ss {Level:u3}] Message {Properties:j}{NewLine}{Exception}
```

**Always include:**
- Correlation ID for request tracing
- Operation context (method name, key parameters)
- Error details in exception logs

## Comments

**When to Comment:**
- Complex business logic requiring explanation
- Non-obvious validation rules or constraints
- Performance-critical sections with optimization rationale
- Workarounds or temporary solutions (marked with `TODO`, `FIXME`, `HACK`)
- RTL/Hebrew-specific handling (e.g., regex pattern reversal)

**JSDoc/TSDoc (Frontend):**
```typescript
/**
 * Fix RTL-corrupted regex patterns before validation
 * RTL text direction can reverse patterns like ^[0-9]{4}$ to ${4}[0-9]^
 */
function unreverseRTLPattern(pattern: string): string { ... }

/**
 * Validation error with Hebrew support
 */
export interface ValidationError {
  field: string;
  message: string;
  messageHebrew: string;
}
```

**XML Documentation (Backend):**
```csharp
/// <summary>
/// Gets a data source by ID with comprehensive error handling
/// </summary>
public async Task<ApiResponse<DataProcessingDataSource>> GetByIdAsync(string id, string correlationId)
```

**Not used extensively:** Avoid over-commenting obvious code. Focus on "why" not "what".

## Function Design

**Size:**
- Frontend components: 100-200 lines typical (split into smaller hooks/utilities if larger)
- Backend services: 50-150 lines per method (extracted into helper methods for complex logic)
- Keep functions focused on single responsibility

**Parameters:**
- Frontend: Props objects for components (e.g., `DataTableProps<T>`)
- Backend: Dependency injection via constructor; method parameters for inputs
- Correlation ID always passed as last parameter in service methods
- Use object destructuring for multiple parameters: `{ page, size, search }`

**Return Values:**
- Frontend: React components return JSX, utilities return typed values or promises
- Backend: Service methods return `ApiResponse<T>` wrapper
- Always return consistent type (never mix null/empty/error representations)
- Use discriminated unions for result types

**Async Operations:**
- Frontend: Async/await exclusively used in API clients and event handlers
- Backend: Async/await for I/O operations (database, messaging, HTTP)
- Always suffix async methods with `Async`

## Module Design

**Exports:**
- Frontend components: Named exports (e.g., `export const DataTable = ...`)
- Frontend utilities: Named exports for functions, default export for main utility class if present
- Backend: Public classes/interfaces for API surface, internal classes for implementation

**Barrel Files:**
- Frontend: Index files re-export related components/utilities from directory
- Example structure: `src/components/shared/index.ts` exports all shared components
- Enables cleaner imports: `import { DataTable, ErrorBoundary } from '@/components/shared'`

**Project Structure Patterns (Frontend):**
- `pages/` - Route-level components
- `components/` - Reusable UI components (organized by feature)
- `services/` - API clients and business logic
- `utils/` - Shared utility functions
- `types/` - TypeScript interfaces and types
- `i18n/` - Internationalization files

**Project Structure Patterns (Backend):**
- `Controllers/` - REST API endpoints
- `Services/` - Business logic interfaces and implementations
- `Repositories/` - Data access layer
- `Models/` - Request/Response DTOs
- `Consumers/` - MassTransit message handlers
- `Jobs/` - Quartz.NET background jobs (if applicable)

## RTL/Hebrew Specific Conventions

**Frontend:**
- Language detection via `i18n.language`
- Direction set on document root: `document.documentElement.dir = isRTL ? 'rtl' : 'ltr'`
- Ant Design direction prop: `<ConfigProvider direction={isRTL ? 'rtl' : 'ltr'}>`
- Technical fields maintain LTR via CSS class: `className="ltr-field"`
- Regex pattern reversal handled in `schemaValidator.ts` to counteract RTL text corruption
- Translation keys follow hierarchical naming: `datasources.create.title`, `errors.validation.required`

**Backend:**
- Error messages in Hebrew via `HebrewErrorResponseFactory`
- Validation error messages include both Hebrew and English versions
- UI-facing strings handled by frontend; backend returns error codes/types

## Correlation ID Pattern

**Used for:**
- Request tracing across service boundaries
- Logging context propagation
- Error diagnostics and debugging

**Implementation:**
- Backend: Generated in controller, passed to all service methods
- Frontend: Used in API client headers (if implemented)
- Format: GUID or unique string identifier
- Carried in Kafka messages via MassTransit context

---

*Convention analysis: 2026-01-28*
