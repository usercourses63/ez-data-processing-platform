# Coding Conventions

**Analysis Date:** 2026-05-24

## Naming Patterns

### Backend (C#)

**Namespaces:**
- Root pattern: `DataProcessing.[ServiceArea]`
- Shared library: `DataProcessing.Shared.[Subarea]` (e.g. `DataProcessing.Shared.Consumers`, `DataProcessing.Shared.Monitoring`)
- Service-specific: `DataProcessing.DataSourceManagement.Services`, `DataProcessing.DataSourceManagement.Controllers`, `DataProcessing.DataSourceManagement.Consumers`
- File-scoped namespace declarations everywhere (e.g. `namespace DataProcessing.Shared.Consumers;` — no braces)
- Example: `src/Services/Shared/Consumers/DataProcessingConsumerBase.cs:8`, `src/Services/DataSourceManagementService/Services/DataSourceService.cs:15`

**Project assemblies:**
- Pattern: `DataProcessing.[Area].csproj` (e.g. `DataProcessing.Shared.csproj`, `DataProcessing.DataSourceManagement.csproj`, `DataProcessing.Validation.csproj`, `DataProcessing.FileProcessor.csproj`)
- Tests: `[Service]Service.Tests.csproj` (e.g. `FileProcessorService.Tests.csproj`)

**Files:**
- One public type per file, PascalCase filename matching type name (e.g. `DataSourceController.cs`, `PipelineEventConsumer.cs`, `OptimisticLockingTests.cs`)
- Test files: `[ClassUnderTest]Tests.cs` (e.g. `CsvToJsonConverterHeaderlessTests.cs`)

**Interfaces:**
- `I` prefix, PascalCase (e.g. `IDataSourceService`, `INasDeviceService`, `IServerService`, `ICategoryService`, `IFileOperationsService`, `IPrometheusQueryService`, `IDataProcessingMessage`)
- Co-located with implementation in the same folder when service-specific: `src/Services/DataSourceManagementService/Services/IDataSourceService.cs` next to `DataSourceService.cs`

**Classes (suffixes are mandatory and indicate role):**
- Controllers → `*Controller` (e.g. `DataSourceController`, `CategoriesController`, `NasDevicesController`)
- Services → `*Service` (e.g. `DataSourceService`, `NasDeviceService`, `PrometheusQueryService`)
- Consumers → `*Consumer` (e.g. `PipelineEventConsumer`, `FileDiscoveredEventConsumer`)
- Repositories → `*Repository` (e.g. `IDataSourceRepository`)
- Background jobs (Quartz) → `*Job`
- Hubs (SignalR) → `*Hub` (e.g. `MonitoringHub`)
- Configuration extension classes → `*Configuration` (e.g. `OpenTelemetryConfiguration`, `LoggingConfiguration`, `MassTransitConfiguration`)
- Events → `*Event` (e.g. `FileDiscoveredEvent`, `ValidationCompletedEvent`, `FileProcessingFailedEvent`, `FileProcessingCompletedEvent`)
- Base classes → `*Base` (e.g. `DataProcessingConsumerBase<T>`, `DataProcessingBaseEntity`)
- DTOs → `*Dto` or `*Request` / `*Response` (e.g. `PipelineEventDto`, `ApiResponse<T>`, `ErrorResponse`)
- Generic factory → `*Factory` (e.g. `HebrewErrorResponseFactory`)

**Async methods:**
- All async methods end with `Async` suffix (e.g. `GetByIdAsync`, `GetPagedAsync`, `ConvertToJsonAsync`)

**Private fields:**
- `_camelCase` underscore prefix (e.g. `_dataSourceService`, `_hubContext`, `_logger`, `_meter`, `_activitySource`)
- See `src/Services/DataSourceManagementService/Controllers/DataSourceController.cs:24-26`

**Static readonly fields:**
- `PascalCase` (e.g. `ActivitySource`, `DataProcessingActivitySource`)
- `private static readonly ActivitySource ActivitySource = new("DataProcessing.DataSourceManagement.Service");` — pattern used across all services

### Frontend (TypeScript / React)

**Files:**
- React components: PascalCase `.tsx` (e.g. `BasicInfoTab.tsx`, `DataSourceList.tsx`, `AppHeader.tsx`)
- Hooks: `useCamelCase.ts` (e.g. `useEntitySync.ts`, `useMonitoringHub.ts`, `useOptimisticMutation.ts`)
- Services / API clients: `kebab-case-api-client.ts` (e.g. `categories-api-client.ts`)
- Utilities: PascalCase `.ts` or `kebab-case.ts`
- E2E specs: `kebab-case.spec.ts` (e.g. `sanity.spec.ts`, `p0-pipeline-flow.spec.ts`, `multi-user-sync.spec.ts`)

**Components:**
- Functional components with `React.FC<Props>` or arrow-function signature: `const DataSourceList: React.FC = () => { ... }`
- See `src/Frontend/src/pages/datasources/DataSourceList.tsx:69`
- Named exports for sub-components, default export for the page-level component

**Interfaces / Types:**
- PascalCase (e.g. `DataSource`, `PagedResult<T>`, `ApiResponse<T>`, `BasicInfoTabProps`, `ImportData`)
- API DTOs keep backend PascalCase property names (e.g. `Name`, `SupplierName`, `IsActive`, `ID`) because backend uses `JsonSerializerOptions.PropertyNamingPolicy = null`. See `src/Services/DataSourceManagementService/Program.cs:38` and `src/Frontend/src/pages/datasources/DataSourceList.tsx:19-50`.
- SignalR payloads handle both casings: `raw.entityType || raw.EntityType` — see `src/Frontend/src/hooks/useEntitySync.ts:28-34`.

## Code Style

### .NET / C#

**Tools:**
- `.editorconfig` at repo root (`C:/Users/Brian/Desktop/ez/.editorconfig`) enforces style; no separate analyzer config.
- `Directory.Build.props` (`C:/Users/Brian/Desktop/ez/Directory.Build.props`) applies project-wide:
  - `<TargetFramework>net10.0</TargetFramework>`
  - `<ImplicitUsings>enable</ImplicitUsings>`
  - `<Nullable>enable</Nullable>`
  - `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` — warnings break the build
  - `<GenerateDocumentationFile>true</GenerateDocumentationFile>` — XML docs required (CS1591 suppressed only because of obsolete files)
- `global.json` pins SDK to `10.0.100` with `rollForward: latestMajor`

**Formatting rules (.editorconfig):**
- Indent: 4 spaces for `.cs`; 2 spaces for XML, JSON, YAML, JS/TS
- Line endings: `CRLF` for C#
- `dotnet_sort_system_directives_first = true`
- `dotnet_separate_import_directive_groups = false`
- No `this.` / `Me.` qualification
- Use language keywords (`int`, `string`) not framework types
- `var` everywhere (built-in types, when apparent, elsewhere)
- Allman braces (open brace on new line); `else`, `catch`, `finally` on new line
- Prefer expression-bodied properties/indexers/accessors; **block-bodied** methods and constructors

### TypeScript / React

**Tools:**
- ESLint extends `react-app` and `react-app/jest` (configured inline in `src/Frontend/package.json:61-65`).
- No `.eslintrc.js` / `.prettierrc` files — formatting is editor-driven via `.editorconfig` (2-space indent).
- TypeScript strict mode enabled: `"strict": true`, `"forceConsistentCasingInFileNames": true`, `"noFallthroughCasesInSwitch": true`, `"isolatedModules": true` — see `src/Frontend/tsconfig.json`.
- Build: Vite + `tsc` type-check (`npm run build` → `tsc && vite build`).
- Lint commands: `npm run lint` / `npm run lint:fix`.

## Import Organization

### C#

**Order:**
1. `System.*` first (enforced by `dotnet_sort_system_directives_first = true`)
2. Third-party (`Microsoft.*`, `MassTransit`, `MongoDB.*`, etc.)
3. Project namespaces (`DataProcessing.Shared.*`, then service-local `DataProcessing.[Service].*`)
4. No blank-line grouping (`dotnet_separate_import_directive_groups = false`)

Example from `src/Services/DataSourceManagementService/Services/DataSourceService.cs:1-13`:
```csharp
using System.ComponentModel.DataAnnotations;
using System.Diagnostics;
using Microsoft.Extensions.Logging;
using DataProcessing.Shared.Entities;
using DataProcessing.Shared.Monitoring;
using DataProcessing.Shared.Messages;
using DataProcessing.DataSourceManagement.Models.Requests;
using DataProcessing.DataSourceManagement.Models.Responses;
using DataProcessing.DataSourceManagement.Repositories;
using MongoDB.Bson;
using MassTransit;
```

### TypeScript

**Order observed:**
1. React + framework (`react`, `react-router-dom`)
2. Third-party UI libs (`antd`, `@ant-design/icons`)
3. Data libs (`@tanstack/react-query`, `i18next`)
4. Local relative imports (`../../services/...`, `./helpers`)

**No path aliases** — relative imports throughout. `tsconfig.json` does not declare a `paths` mapping; `vite-tsconfig-paths` is installed but unused for aliasing.

## Error Handling

### Backend

**Service-layer pattern (universal):**
1. Wrap entire method body in `try { ... } catch (Exception ex)`.
2. On entry, open an OpenTelemetry activity and tag it with `correlation-id` plus operation-specific tags.
3. Log warnings for validation failures, errors for caught exceptions.
4. Return a typed `ApiResponse<T>` — never throw to controllers; let services translate to `ApiResponse<T>.Failure(...)`.
5. Use `HebrewErrorResponseFactory` to build user-facing error messages in Hebrew (`HebrewErrorResponseFactory.CreateNotFoundError`, `.CreateRequiredFieldError`, `.CreateDatabaseError`).
6. See `src/Services/DataSourceManagementService/Services/DataSourceService.cs:50-88` for the canonical example.

**Consumer-layer pattern (`DataProcessingConsumerBase<T>`):**
- Base class wraps `ProcessMessage` in try/catch, emits success/error metrics with tags `{message_type, consumer_type, published_by, status, error_type}`.
- `ShouldRetryOnError(Exception)` decides via pattern-matching switch — DO NOT retry on `ArgumentException`, `ArgumentNullException`, `NotSupportedException`, `NotImplementedException`. DO retry on `TimeoutException`, `TaskCanceledException`, `HttpRequestException`. Throwing re-engages MassTransit retry.
- Override `HandleProcessingError` for custom side effects; the base implementation just logs.
- Reference: `src/Services/Shared/Consumers/DataProcessingConsumerBase.cs:51-213`.

**Controller pattern:**
- Extract `correlationId` first thing (`GetCorrelationId()` helper) and pass to service.
- Log every inbound request with method + path + correlationId.
- Translate service `ApiResponse` failures into HTTP status via `StatusCode(result.Error!.StatusCode, ErrorResponse.Create(...))`.
- Decorate actions with `[ProducesResponseType(typeof(...), code)]` for every documented status — 200, 400, 404, 500 at minimum.
- See `src/Services/DataSourceManagementService/Controllers/DataSourceController.cs:18-73`.

### Frontend

- `useQuery` returns `{ data, isLoading, error }` — render error state inline with Ant Design `Alert` component. See `src/Frontend/src/components/datasource/tabs/BasicInfoTab.tsx:68-86`.
- Top-level `<ErrorBoundary>` wraps the entire app in `src/Frontend/src/App.tsx:91`.
- Network failures in side-effect hooks (`useEntitySync`) use `.catch(err => console.warn(...))` — never throw to React render.

## Logging

### Backend

**Framework:** Serilog routed through OpenTelemetry OTLP exporter to Elasticsearch + console.
- Configured via `services.AddDataProcessingLogging(configuration, builder.Environment, serviceName)` in every `Program.cs`.
- Implementation: `src/Services/Shared/Configuration/LoggingConfiguration.cs`.

**Patterns:**
- Always inject `ILogger<TClass>` (typed) via constructor; never use `ILoggerFactory` at call site.
- Use structured logging with named placeholders, never string interpolation:
  - YES: `_logger.LogInformation("Retrieving data source by ID: {Id}. CorrelationId: {CorrelationId}", id, correlationId);`
  - NO: `_logger.LogInformation($"Retrieving data source by ID: {id}");`
- Every log line that crosses a service boundary includes `{CorrelationId}` as the last property.
- Severity guidelines:
  - `LogDebug` — high-volume per-message traces (e.g. consumer message logs in `PipelineEventConsumer`)
  - `LogInformation` — request/response, lifecycle, success
  - `LogWarning` — validation failures, recoverable issues, stale data
  - `LogError(ex, ...)` — exception with full context (always pass the exception as first arg)

### Frontend

- Logging is `console.log` / `console.warn` only — no shared logger.
- Convention: prefix with bracketed component/hook name. Example: `console.log("[EntitySync] DataSource abc-123 updated v2")` — see `src/Frontend/src/hooks/useEntitySync.ts:34`.
- E2E tests use `console.log` for SANITY-NN progress markers.

## Comments

**When to Comment:**
- XML doc comments (`/// <summary>`) are MANDATORY on public types and methods because `<GenerateDocumentationFile>true</GenerateDocumentationFile>` is set in `Directory.Build.props`. CS1591 is only suppressed for legacy code.
- Document `<typeparam>`, `<param>`, `<returns>`, and `<response code="N">` for ASP.NET controller actions.
- Example: `src/Services/DataSourceManagementService/Controllers/DataSourceController.cs:13-57`.

**TypeScript:**
- JSDoc block comment at top of every hook explaining purpose. See `src/Frontend/src/hooks/useEntitySync.ts:1-5`.
- Inline `// comment` for non-obvious logic (e.g. RTL workaround in `sanity.spec.ts:62`).
- Test specs use a header block stating suite purpose + run command.

## Function / Method Design

**Backend:**
- Async-by-default — sync methods only for pure helpers.
- Single responsibility — `DataSourceService.GetByIdAsync` does one thing; pagination, filtering, validation are separate methods.
- All public methods accept `correlationId` as a parameter and pass it through to the repository, metrics, and logs.
- Return `ApiResponse<T>` for service methods, `IActionResult` for controllers.

**Frontend:**
- Components are functional with hooks; no class components.
- One default export per component file; named exports for sub-components and types.
- Forms use Ant Design `<Form.Item>` with `rules` array — see `BasicInfoTab.tsx:27-40`.

## Module Design

**Backend:**
- Each service is its own assembly under `src/Services/[Name]Service/`.
- Shared cross-cutting code lives in `src/Services/Shared/` and is consumed via `<ProjectReference Include="..\Shared\DataProcessing.Shared.csproj" />`.
- DI configuration uses extension-method pattern in `Shared/Configuration/*.cs` (e.g. `AddDataProcessingOpenTelemetry`, `AddDataProcessingLogging`) — call site in `Program.cs` is one-line per concern.

**Frontend:**
- Pages live in `src/Frontend/src/pages/[area]/PageName.tsx` and are lazy-loaded via `React.lazy` in `App.tsx:34-49`.
- Components live in `src/Frontend/src/components/[area]/` — datasource form tabs in `components/datasource/tabs/`, schema editors in `components/schema/`, etc.
- Hooks live in `src/Frontend/src/hooks/` and are mounted globally in `App.tsx` via wrapper provider components (e.g. `<EntitySyncProvider>` calls `useEntitySync()` then renders `{children}`).
- No barrel files for the broader app; `src/Frontend/tests/e2e/support/index.ts` is one of the few barrels.

## Dependency Injection Patterns

**Backend:**
- Constructor injection only — see every controller, service, and consumer.
- Order in constructor: domain services → cross-cutting (`IPublishEndpoint`, `IHubContext<>`, `BusinessMetrics`) → `ILogger<T>` last.
- Singletons in `Program.cs`:
  - `services.AddSingleton(activitySource);`
  - `services.AddSingleton<BusinessMetrics>();`
  - SignalR hubs registered via `services.AddSignalR()`.
- Service registration extension methods: `AddDataProcessingOpenTelemetry`, `AddDataProcessingLogging`, `AddDataProcessingDatabase`, `AddDataProcessingMassTransit`, etc. — all defined in `src/Services/Shared/Configuration/`.

## OpenTelemetry Activity Tracing

**Pattern (required for every service method that crosses a boundary):**
```csharp
private static readonly ActivitySource ActivitySource = new("DataProcessing.[Area].Service");

public async Task<ApiResponse<T>> DoWorkAsync(string id, string correlationId)
{
    using var activity = ActivitySource.StartActivity("DoWorkAsync");
    activity?.SetTag("correlation-id", correlationId);
    activity?.SetTag("data-source-id", id);
    // ... work ...
}
```
- Use `using var activity = ...StartActivity(...)` so the span auto-closes.
- Always tag `correlation-id`. Add operation-specific tags (e.g. `page`, `size`, `data-source-id`) for filtering in Jaeger.
- Activity sources are named `DataProcessing.[Area].[Subarea]` and registered in `OpenTelemetryConfiguration.AddMeter("DataProcessing.Business.*")`. See `src/Services/Shared/Configuration/OpenTelemetryConfiguration.cs:74-80`.

## Metric Counters in Catch Blocks

**Pattern:**
- Inject `BusinessMetrics` into every service that emits domain metrics.
- On caught exceptions, the base consumer `DataProcessingConsumerBase` automatically records `dataprocessing_messages_errored_total` with tag `error_type = ex.GetType().Name`.
- Service methods that catch their own exceptions should call into `BusinessMetrics` to increment a domain-specific counter before returning a failure response — see usage of `_metrics` in `DataSourceService`.
- Legacy `DataProcessingMetrics` (Prometheus-net) is `[Obsolete]` — see `src/Services/Shared/Monitoring/DataProcessingMetrics.cs:28`. Use `BusinessMetrics` for all new code.

## SignalR Real-Time Sync

**Backend (every controller that mutates state MUST):**
1. Inject `IHubContext<MonitoringHub> _hubContext`.
2. After create/update/delete, broadcast:
   ```csharp
   await _hubContext.Clients.All.SendAsync("EntityChanged", new
   {
       EntityType = "DataSource",   // or "AdminServer", "NasDevice", "Category", "InvalidRecord"
       EntityId   = entity.ID.ToString(),
       Action     = "created",      // "created" | "updated" | "deleted"
       Version    = entity.Version
   });
   ```
3. Already implemented in `DataSourceController`, `ServersController`, `CategoriesController`, `NasDevicesController`.

**Frontend:**
- Global `useEntitySync()` hook is mounted once in `App.tsx` via `<EntitySyncProvider>`.
- Hook subscribes to `EntityChanged`, maps the entityType to React Query keys, and calls `queryClient.invalidateQueries({ queryKey: [...] })`.
- Also dispatches a DOM `CustomEvent('entity-changed', { detail })` for pages that use raw `fetch` instead of React Query.
- Reference: `src/Frontend/src/hooks/useEntitySync.ts`.

## React / Ant Design Patterns

**Setup in `App.tsx`:**
- `<ConfigProvider direction={isRTL ? 'rtl' : 'ltr'}>` wraps the app and feeds Ant Design `he_IL` or `en_US` locale.
- `document.documentElement.dir` and `lang` synced on every language change (`App.tsx:70-73`).
- `<AntApp>` wrapper provides `App.useApp()` modal/message/notification APIs (consumed via `const { modal, message: appMessage } = App.useApp();`).
- Theme uses Rubik font for Hebrew RTL.

**React Query setup:**
- Single `QueryClient` created at module scope with `refetchOnWindowFocus: false`, `retry: 1`, `staleTime: 5 * 60 * 1000` (5 minutes).
- See `src/Frontend/src/App.tsx:54-62`.

**Component patterns:**
- Lazy-load every page route with `React.lazy(() => import(...))` for code splitting (App.tsx:34-49).
- Forms: Ant `<Form>` with `name`, `label`, `rules` prop; validation messages in Hebrew literal strings or i18next keys.
- Tables: `ColumnsType<T>` typed columns, sorting/pagination via Ant `<Table>` props.

## RTL / Hebrew Handling

- App-wide direction set on `<html dir>` and on Ant Design `<ConfigProvider direction>`.
- Hebrew is the default locale (`isRTL = i18n.language === 'he'`); Rubik font applied via theme token.
- **Technical fields stay LTR via `.ltr-field` class** — apply to inputs for regex, paths, URLs, PromQL, cron expressions.
- i18next backed by JSON files at `src/Frontend/src/locales/he/translation.json` and `.../en/translation.json`. Use the `useTranslation` hook: `const { t, i18n } = useTranslation();`.
- Hebrew literal strings are acceptable for one-off validation rules (e.g. `'שם מקור הנתונים חייב להיות לפחות 2 תווים'` in `BasicInfoTab.tsx:32`) but prefer `t('errors.required')` for shared messages.
- E2E tests target Hebrew button labels: `page.getByRole('button', { name: /הוסף מקור נתונים חדש/i })`.

## API Conventions

**Backend JSON serialization:**
- `PropertyNamingPolicy = null` keeps **PascalCase** on the wire — see `src/Services/DataSourceManagementService/Program.cs:38`.
- `JavaScriptEncoder.UnsafeRelaxedJsonEscaping` preserves Hebrew without `\uXXXX` escaping.

**Request/response envelopes:**
- All endpoints return `ApiResponse<T>` shape: `{ CorrelationId, Data, Error, IsSuccess }`.
- Error responses use `ErrorResponse.Create(correlationId, error)` with `StatusCode`.

**Routes:**
- `[Route("api/v1/[controller]")]` — versioned, lowercase via controller name (`DataSourceController` → `/api/v1/datasource`).
- Use `[ProducesResponseType]` for every documented status code; `[Produces("application/json")]` + `[Consumes("application/json")]` at controller level.

## Kubernetes Manifest Conventions

**Namespace:** All resources in `ez-platform`.

**Labels (mandatory on every deployment/service/pod):**
```yaml
labels:
  app: <service-name>           # e.g. datasource-management
  component: api | worker | infrastructure
  tier: backend | frontend | data
```

**OCP Security Context (every pod):**
```yaml
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: <name>
        securityContext:
          allowPrivilegeEscalation: false
          capabilities:
            drop:
              - ALL
```
- Reference: `release-package/k8s/deployments/datasource-management-deployment.yaml:31-46`.
- `readOnlyRootFilesystem: true` for stateless services where filesystem writes aren't required.

**Image policy:**
- Image tags MUST be pinned to a specific version (e.g. `ez-platform/datasource-management:v0.1.1-rc3`). Never `:latest`.
- `imagePullPolicy: IfNotPresent` (NOT `Never`) so OCP can re-pull on rescheduling.

**Ports:**
- All containers use non-privileged ports >1024.
- Frontend container: `8080` (not `80`).
- Docs container: `8080` (not `80`).
- Service ports map: `5001` datasource-mgmt, `5002` metrics-config, `5003` validation, `5004` scheduling, `5007` invalid-records, `5008` fileprocessor, `5009` output.

**Health probes (required on every deployment):**
- `livenessProbe` → `httpGet /health`, `initialDelaySeconds: 30`, `periodSeconds: 10`
- `readinessProbe` → `httpGet /health`, `initialDelaySeconds: 15`, `periodSeconds: 5`
- Optional `startupProbe` for slow-starting services.

**Resources (set on every container):**
- `requests.cpu`, `requests.memory`, `limits.cpu`, `limits.memory` all specified.
- Typical API service: requests `500m / 1Gi`, limits `2000m / 3Gi`. See `release-package/k8s/deployments/datasource-management-deployment.yaml:61-67`.

**Rolling update strategy:**
- `strategy.type: RollingUpdate` with `maxSurge: 1`, `maxUnavailable: 0` for zero-downtime deploys.

**Env vars from ConfigMaps:**
- Connection strings, Kafka brokers, OTLP endpoints injected via `valueFrom.configMapKeyRef` pointing at `services-config` ConfigMap.
- Secrets (passwords, API keys) injected via `valueFrom.secretKeyRef`.

**NetworkPolicies (`release-package/k8s/network-policies.yaml`):**
- Default `deny-ingress` policy applied namespace-wide (`podSelector: {}`).
- Each service has an explicit `allow-frontend-to-<service>` or `allow-services-to-<infrastructure>` policy listing the caller via `podSelector.matchLabels.app`.
- Example: `allow-frontend-to-api` lets pods with `app: frontend` reach `app: datasource-management` on port `5001` only.

## Commit Message Style

Examined `git log --oneline -20` (most recent commits on `main`):

**Format:** Conventional Commits with scope.
```
<type>(<scope>): <subject>
```

**Types observed:**
- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation / phase completion notes
- `chore` (rare)

**Scope conventions:**
- Service / component name: `(frontend)`, `(filediscovery)`, `(validation+rates)`, `(port-forward)`
- Phase number with optional task: `(phase-32)`, `(32-01)`, `(32-02)`, `(32-wave1)`
- Multi-area: `(validation+sanity)`, `(sanity+ports)`

**Subject conventions:**
- Lowercase first letter, no trailing period
- Use an em-dash to attach a clarifier: `fix(frontend): nginx proxy port validation — prevent invalid-records 5006→5007 regression`
- Reference ticket/sanity IDs inline: `SANITY-17/18`, `Task 6`, `MON-07`

**Concrete recent examples:**
```
fix(frontend): nginx proxy port validation — prevent invalid-records 5006→5007 regression
docs(milestone): v0.2 milestone audit — tech debt status, 33/33 phases complete
docs(phase-32): complete phase execution (gaps accepted)
fix(filediscovery): move dedup hash write after successful publish to prevent stale blocking
docs(32-03): complete pipeline acceptance + docs navigation plan
fix(validation+rates): 4Gi memory limit + 11s cleanup delays SANITY-17/18
fix(sanity-01): retry health check 3x with 5s backoff
feat(install): load images + clean stale tags; Task 6 adds demo data step
```

**After every completed task** (per `CLAUDE.md`): commit + push with descriptive message.

---

*Convention analysis: 2026-05-24*
