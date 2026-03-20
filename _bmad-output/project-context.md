---
project_name: 'EZ'
user_name: 'UserC'
date: '2026-03-17'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 47
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

### Backend (.NET 10.0)
- **Runtime:** .NET 10.0, ASP.NET Core Web API
- **Database:** MongoDB.Driver 3.2.0 + MongoDB.Entities 24.1.1
- **Messaging:** MassTransit 8.5.7 + RabbitMQ (internal service-to-service only) + Kafka via Confluent.Kafka 2.12.0 (external input/output to EZ platform only)
- **Scheduling:** Quartz.NET 3.15.1
- **Cache:** Hazelcast.Net 5.5.1
- **Resilience:** Polly 8.5.2
- **Validation:** Corvus.Json.Validator 4.3.9 (JSON Schema 2020-12)
- **File Transfer:** FluentFTP 49.0.2, SSH.NET 2025.1.0, SMBLibrary 1.5.5.1, AWSSDK.S3
- **Observability:** OpenTelemetry 1.14.0, Serilog 4.3.0, Prometheus-net 8.2.1
- **Testing:** xUnit 2.9.2, Moq 4.20.72, FluentAssertions 7.0.0
- **API Docs:** Swashbuckle 10.0.1
- **Package Management:** Central Package Management (Directory.Packages.props) — NEVER put versions in .csproj

### Frontend (React 19 + TypeScript 5.9.3)
- **Build:** Vite 5.4.21
- **UI:** Ant Design 5.x (RTL-enabled)
- **State:** TanStack React Query 5.90.2
- **i18n:** i18next 23.5.1 (Hebrew primary, English secondary)
- **Editor:** Monaco Editor 0.54.0
- **Charts:** Recharts 2.8.0
- **E2E Testing:** Playwright 1.49.0
- **Unit Testing:** React Testing Library 14.1.2
- **TypeScript:** Strict mode enabled, target ES2020, bundler module resolution

### Infrastructure
- Kubernetes (Minikube Hyper-V), namespace: `ez-platform`
- Kafka (dual listener: 9092 internal, 9094 external)
- MongoDB 3-node Replica Set (requires `?directConnection=true` for dev)
- Prometheus (dual: system 9090 + business 9091), Grafana, Jaeger, Elasticsearch
- OCP-compatible: non-root, non-privileged ports (>1024), restricted-v2 SCC

## Critical Implementation Rules

### Language-Specific Rules

#### C# (.NET)
- File-scoped namespaces throughout (`namespace X;` not block-scoped)
- Nullable enabled globally — handle nullability properly
- `PropertyNamingPolicy = null` — backend JSON uses **PascalCase** (not camelCase)
- Entities inherit `DataProcessingBaseEntity` (extends MongoDB.Entities `Entity`) with soft delete, optimistic concurrency, correlation ID tracking
- All service methods are async — consumers override `ProcessMessage(ConsumeContext<T>)`
- **Kafka = external I/O only** (data ingestion into and output from EZ platform). **RabbitMQ = internal messaging only** (MassTransit producer/consumer communication between services). Never use Kafka for inter-service messaging or RabbitMQ for external data flow.

#### TypeScript
- Strict mode with `forceConsistentCasingInFileNames`, `noFallthroughCasesInSwitch`
- API clients use raw `fetch()` with **PascalCase** property names matching backend — NOT camelCase
- Default error messages in **Hebrew** in API clients (e.g., `'שגיאה באחזור שרתים'`)
- React Query key factories — each API client exports `*QueryKeys` object with hierarchical keys
- `API_BASE_URL = ''` — empty string, relies on proxy or same-origin
- No axios in API clients despite being in package.json — use native `fetch()`

### Framework-Specific Rules

#### ASP.NET Core / MassTransit
- All consumers inherit `DataProcessingConsumerBase<T>` — provides correlation ID tracking, metrics (counters + histograms), activity tracing, and retry logic
- Retry policy via `ShouldRetryOnError`: retries on `TimeoutException`, `HttpRequestException`; skips on `ArgumentException`, `NotSupportedException`
- DI configuration centralized in `Shared/Configuration/` — `DatabaseConfiguration`, `MassTransitConfiguration`, `OpenTelemetryConfiguration`, etc.
- Service pattern: Interface (`IXxxService`) + implementation (`XxxService`) with constructor DI
- Controller pattern: REST API at `/api/v1/{resource}`, returns domain objects directly
- Health checks at `/health` on each service, composed from MongoDB + Kafka + Elasticsearch checks

#### React / Ant Design
- **RTL-first:** Hebrew is primary language, Ant Design `ConfigProvider` with `direction="rtl"`
- **`.ltr-field`** CSS class required on all technical fields (regex, paths, URLs, PromQL, code editors)
- **Ant Design tab click gotcha:** Playwright `.click()` on Ant Design tabs does NOT trigger React state — must use `dispatchEvent(new MouseEvent('click', {bubbles:true}))`
- Tab selectors: `[data-node-key="xxx"]` for outer div, `[id$="-tab-xxx"]` for button
- **Lazy tab + Form.setFieldsValue bug:** Values silently discarded for unmounted Form.Items — pass saved values as props and re-apply via `useEffect` after mount
- **Select + async options:** Ant Design `<Select>` drops values set before options load — need `useEffect` watching the options array to re-apply
- RTL overflow: Tabs can be pushed offscreen (x < 0) — widen viewport to 1400px in tests

### Testing Rules

#### Testing Philosophy
- **UI-first testing:** The frontend UI is the primary testing surface — test every feature, button, selection, component, and control
- **Backend as validation:** Backend services are tested indirectly by supporting frontend actions — not tested in isolation
- **Tools:** Playwright (automated E2E) + Chrome Claude extension (interactive debugging/verification)
- **Zero tolerance:** Fix ALL failures until 100% pass rate — no skipping, no known-failures
- **Comprehensive scenarios:** Each test covers a full feature flow end-to-end, not isolated UI clicks

#### Test Scenario Architecture
Tests should follow the **full-feature-flow pattern** — create infrastructure, configure features, verify pipeline:

1. **Infrastructure setup** — Create required devices/servers (NAS, FTP, SFTP, Kafka, S3, HTTP) using file-simulator-suite
2. **Feature configuration** — Create/configure the feature through ALL UI tabs and controls (every field, every selection)
3. **Save & verify** — Save configuration, verify success response
4. **Pipeline validation** — Trigger and verify the full data pipeline (discovery → processing → validation → output)
5. **Cleanup** — Remove test artifacts

**Example comprehensive scenario:**
- Create NAS device → PV/PVC bind → mount → verify connection
- Create new datasource → select category → configure ALL tabs (connection, input server, output destinations, scheduling, schema, etc.)
- Use the newly created NAS as input source (also test FTP, Kafka, etc.)
- Configure output destinations
- Save datasource → verify success
- Trigger pipeline → verify file discovery → processing → validation → output delivery

#### External Test Dependencies
- **File Simulator Suite:** Located at `C:\Users\UserC\source\repos\file-simulator-suite` — provides dynamic FTP, SFTP, NAS, S3, HTTP, and Kafka test servers
- **Minikube cluster:** Tests require running `ez-platform` namespace with all services deployed
- **Cross-cluster networking:** File simulator runs on separate minikube profile (`file-simulator`, IP: 172.30.26.249)

#### Playwright Configuration
- 3 test projects: `chromium` (UI), `protocols` (cross-cluster, 2min timeout, sequential), `e2e-validation` (pipeline, 3min timeout, sequential)
- Base URL: `http://localhost:7000` (K8s port-forward)
- Visual regression: 30% pixel diff tolerance, animations disabled
- Global setup/teardown for protocol health checks

#### Known Test Gaps to Address
- Only CSV format fully tested (XML, Excel, JSON need coverage)
- Max 100 records tested (need high-load scenarios)
- Only 2 output destinations tested (need 4+)
- No backend unit/integration test projects exist
- Not all UI tabs/components have E2E coverage

### Code Quality & Style Rules

#### Naming Conventions
- **Backend namespaces:** `DataProcessing.*` (e.g., `DataProcessing.Shared.Entities`)
- **Interfaces:** `I` prefix (e.g., `IDataSourceService`)
- **Classes:** `Service`, `Consumer`, `Controller` suffixes
- **Entities:** PascalCase properties, inherit `DataProcessingBaseEntity`
- **Frontend files:** kebab-case (`servers-api-client.ts`), PascalCase for components
- **API routes:** `/api/v1/{resource}` (lowercase, plural)
- **Kafka topics:** `dataprocessing.{area}.{action}` (dotted lowercase)
- **Events:** `{Action}Event` suffix (e.g., `FileDiscoveredEvent`)

#### Code Organization
- Backend per-service: `Controllers/`, `Services/`, `Repositories/`, `Consumers/`, `Models/`, `Jobs/`
- Frontend: `pages/`, `components/{feature}/`, `services/`, `utils/`, `types/`, `i18n/`
- Shared library: `src/Services/Shared/` — Configuration, Connectors, Converters, Entities, Messages, Consumers, Monitoring
- Translation files: `src/Frontend/src/i18n/locales/he.json` and `en.json` (NOT `src/locales/he/translation.json`)

#### Documentation
- XML doc comments on public C# classes and methods
- JSDoc comments on TypeScript API client functions
- No mandatory inline comments — code should be self-documenting

### Development Workflow Rules

#### Git & Repository
- Branch naming: `feature/v{version}` (e.g., `feature/v0.3.0`)
- Commit messages: Conventional — `feat(scope): description`, `docs(scope): description`, `fix(scope): description`
- Main branch: `main`

#### Build & Deploy
- Backend: `docker build` → `minikube image load` → `kubectl set image` — **must use new image tags each time** (minikube caches by tag, reusing won't update)
- Frontend: same pattern — current image: `frontend:v15`
- Full deploy: `bash k8s/deploy-all.sh` or individual `kubectl apply -f`
- **Port forwarding:** ALWAYS use `scripts/start-port-forwards.ps1` (18 ports) — never individual `kubectl port-forward`

#### Kubernetes
- Namespace: `ez-platform` for all resources
- ConfigMaps in `k8s/configmaps/` — restart deployments after changes
- OCP compliance mandatory: non-root, non-privileged ports (>1024), `restricted-v2` SCC, pinned image versions, `imagePullPolicy: IfNotPresent`
- MongoDB requires `rs.initiate()` after fresh deploy (single-node replica set)
- MongoDB connection MUST include `?directConnection=true` for dev

### Critical Don't-Miss Rules

#### Anti-Patterns to Avoid
- **NEVER** put package versions in `.csproj` — Central Package Management via `Directory.Packages.props` only
- **NEVER** use camelCase in API payloads — backend expects PascalCase (`Id` not `id`, `Name` not `name`)
- **NEVER** use Kafka for inter-service messaging — Kafka is external I/O only, RabbitMQ for internal MassTransit
- **NEVER** use `kubectl port-forward` individually — use `scripts/start-port-forwards.ps1`
- **NEVER** reuse minikube image tags — always increment (`v15` → `v16`)
- **NEVER** use `:latest` image tag — all images pinned to specific versions
- **NEVER** use privileged ports (<1024) — OCP requires non-privileged (frontend: 8080, not 80)

#### Edge Cases & Gotchas
- `Path.Combine(base, "/")` returns `"/"` in .NET — must strip leading `/` from paths
- SMBLibrary hardcodes port 445 — NodePort doesn't work, requires minikube tunnel + LoadBalancer
- NFSv4 required for cross-cluster NFS — NFSv3 needs mountd port not exposed via NodePort
- First write to newly-mounted NFSv4 volume takes ~57s (cache warmup) — use 60s timeout
- Kafka `InconsistentClusterIdException` after restart — must delete BOTH StatefulSets + PVCs + released PVs
- Ant Design `<Select>` silently drops values set before options load
- Ant Design tab `.click()` in Playwright doesn't trigger React state change — use `dispatchEvent`
- NAS Role enum mismatch: backend returns numeric (0=Input, 1=Output, 2=Backup, 3=Both), frontend types declare string union

#### Security Rules (OCP Mandatory)
- All pods: `runAsNonRoot: true`, `runAsUser: 1000`, `readOnlyRootFilesystem: true`, `drop ALL capabilities`
- `seccompProfile: RuntimeDefault`, `allowPrivilegeEscalation: false`
- Network Policies: default deny-all-ingress, explicit allow rules per service

#### Performance Targets
- File processing: <1s per 100-record file
- Hazelcast cache hit rate: >95% (TTL: 300s, max-idle: 180s, LRU eviction, 256MB/map)
- Service startup: <5s
- P99 API latency: <500ms

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-03-17
