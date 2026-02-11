# Domain Pitfalls: v0.2 Production Validation & Release

**Domain:** Adding SignalR, OTEL verification, file-simulator integration, device health monitoring, archive extraction, and production release to existing .NET 10 + React 19 microservices on Kubernetes (air-gapped OCP)
**Researched:** 2026-02-11
**Overall Confidence:** HIGH (based on official documentation, GitHub issues, and codebase analysis)

---

## Critical Pitfalls

Issues that can cause production outages, major rewrites, or data loss.

---

### CP-01: SignalR WebSocket Routing Failures in Kubernetes

**What goes wrong:** SignalR connections fail intermittently or after pod restarts. Clients receive 404 errors during connection establishment. Messages don't reach all connected clients.

**Why it happens:** SignalR uses a Connection ID assigned during negotiation. If the negotiate request and subsequent WebSocket upgrade go to different pods (due to load balancer round-robin), the second pod won't recognize the Connection ID and returns 404.

**Root cause in EZ Platform context:** The platform already has NGINX Ingress and multiple service replicas. Adding SignalR without sticky sessions or skipping negotiation will fail.

**Consequences:**
- Real-time device health updates don't reach all clients
- Connection storms when clients retry repeatedly
- Users see stale data, think system is broken
- Pod scaling causes mass disconnections

**Prevention:**
1. **Skip negotiation + WebSockets-only** (RECOMMENDED for EZ Platform):
   ```csharp
   // Client-side configuration
   var connection = new HubConnectionBuilder()
       .WithUrl("https://api/hubs/deviceHealth", options =>
       {
           options.SkipNegotiation = true;
           options.Transports = HttpTransportType.WebSockets;
       })
       .WithAutomaticReconnect()
       .Build();
   ```
   This eliminates the negotiation step entirely. WebSocket connections are long-lived and stay on the same pod.

2. **Add Redis backplane for multi-pod messaging**:
   ```csharp
   // Program.cs
   builder.Services.AddSignalR()
       .AddStackExchangeRedis(redisConnectionString, options =>
       {
           options.Configuration.ChannelPrefix = RedisChannel.Literal("EZPlatform");
       });
   ```
   This ensures messages sent on one pod reach clients connected to other pods.

3. **Configure Ingress for WebSocket support**:
   ```yaml
   # Ingress annotation for NGINX
   metadata:
     annotations:
       nginx.org/websocket-services: "device-health-service"
       nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
       nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
   ```

**Detection (warning signs):**
- Logs showing "Connection ID not found" or 404 responses to SignalR endpoints
- Client-side console errors: "WebSocket connection failed"
- Sporadic real-time updates that work then stop
- Issue appears only when replicas > 1

**Phase to address:** Phase 10-04 (Device Health Monitoring with SignalR)

**Sources:**
- [Microsoft Learn: SignalR scaling](https://learn.microsoft.com/en-us/aspnet/core/signalr/scale)
- [G-Research: SignalR on Kubernetes](https://www.gresearch.com/news/signalr-on-kubernetes/)
- [NGINX Ingress WebSocket configuration](https://www.pumpingco.de/blog/using-signalr-in-kubernetes-behind-nginx-ingress/)

---

### CP-02: SignalR Client Reconnection After Pod Restarts

**What goes wrong:** When pods restart (during deployments or crashes), clients don't reconnect. Users must refresh the page to restore real-time functionality.

**Why it happens:** SignalR automatic reconnection is disabled by default. Clients don't have retry logic. Group memberships are lost on reconnection.

**Consequences:**
- Users don't see device health updates after any deployment
- Support tickets about "real-time stopped working"
- Users develop habit of refreshing page constantly
- Perceived reliability issues

**Prevention:**
1. **Enable automatic reconnection with retry delays**:
   ```typescript
   // React client
   const connection = new HubConnectionBuilder()
     .withUrl('/hubs/deviceHealth', {
       skipNegotiation: true,
       transport: signalR.HttpTransportType.WebSockets
     })
     .withAutomaticReconnect([0, 1000, 5000, 10000, 30000]) // Progressive backoff
     .configureLogging(LogLevel.Warning)
     .build();

   connection.onreconnecting(error => {
     console.log('Reconnecting...', error);
     // Show UI indicator
   });

   connection.onreconnected(connectionId => {
     // Re-subscribe to groups/topics
     connection.invoke('SubscribeToDevice', deviceId);
   });
   ```

2. **Re-establish group memberships on reconnect**:
   ```csharp
   // Server-side hub
   public override async Task OnConnectedAsync()
   {
       var userId = Context.User?.Identity?.Name;
       if (!string.IsNullOrEmpty(userId))
       {
           // Store connection mapping for reconnection
           await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
       }
       await base.OnConnectedAsync();
   }
   ```

3. **Add connection state UI indicator**:
   ```typescript
   const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
   // Show visual indicator to users
   ```

**Detection:**
- User reports "updates stopped" after deployments
- Server logs show connection count dropping to zero after restarts
- No reconnection attempts in network tab

**Phase to address:** Phase 10-04 (Device Health Monitoring)

**Sources:**
- [Microsoft Learn: Client disconnections](https://learn.microsoft.com/en-us/azure/azure-signalr/signalr-concept-client-disconnections)
- [SignalR connection lifetime events](https://learn.microsoft.com/en-us/aspnet/signalr/overview/guide-to-the-api/handling-connection-lifetime-events)

---

### CP-03: OpenTelemetry Traces Not Appearing Despite Configuration

**What goes wrong:** Services claim to export telemetry but Jaeger shows no traces, or traces are incomplete with missing service spans.

**Why it happens:** ActivitySource not registered with TracerProvider. Different ActivitySource names between creation and registration. TracerProvider disposed too early.

**Root cause in EZ Platform context:** The codebase uses `DataProcessingActivitySource` but each service might create additional ActivitySources that aren't registered. The `OpenTelemetryConfiguration.cs` registers sources like "DataProcessing.Platform" but services may use different names.

**Consequences:**
- Can't trace requests across services
- Performance issues invisible
- Debugging production issues becomes impossible
- False confidence in observability

**Prevention:**
1. **Verify all ActivitySource names match registration**:
   ```csharp
   // In OpenTelemetryConfiguration.cs - current sources:
   .AddSource("DataProcessing.Platform")
   .AddSource("DataProcessing.Consumer")
   .AddSource("DataProcessing.Validation")
   .AddSource("DataProcessing.FileProcessor")
   .AddSource("MassTransit")
   .AddSource($"{serviceName}.*")

   // Any new ActivitySource MUST be added here
   // Common miss: Custom activity sources in new features
   ```

2. **Use single static ActivitySource per service**:
   ```csharp
   // GOOD - static readonly singleton
   public static readonly ActivitySource ActivitySource =
       new("DataProcessing.Platform", "1.0.0");

   // BAD - creating new instances
   var source = new ActivitySource("MyFeature"); // Won't be registered!
   ```

3. **Verify traces exist before claiming done**:
   ```bash
   # Check Jaeger for service traces
   curl "http://localhost:16686/api/services" | jq '.'
   # Should list all 9 services

   # Check specific service traces
   curl "http://localhost:16686/api/traces?service=DataSourceManagement&limit=5" | jq '.data | length'
   # Should be > 0
   ```

**Detection:**
- Jaeger service list missing services
- Trace spans don't connect across services (broken parent-child)
- Only HTTP-level traces, no custom operation traces
- Prometheus metrics exist but traces don't

**Phase to address:** Phase 10-02 (OTEL Verification)

**Sources:**
- [OpenTelemetry .NET best practices](https://opentelemetry.io/docs/languages/dotnet/traces/best-practices/)
- [OpenTelemetry troubleshooting](https://opentelemetry.io/docs/collector/troubleshooting/)
- [Missing traces issue #4074](https://github.com/open-telemetry/opentelemetry-dotnet/issues/4074)

---

### CP-04: RTL Layout Regressions in Ant Design 5.x

**What goes wrong:** Hebrew RTL layout breaks after updates or new feature additions. Components display incorrectly - fixed columns wrong side, icons reversed, badges mispositioned.

**Why it happens:** Ant Design 5.x has known RTL bugs. CSS class-based RTL styling (.rtl class) conflicts with ConfigProvider direction. New components added without RTL testing.

**Root cause in EZ Platform context:** The codebase uses both ConfigProvider `direction={isRTL ? 'rtl' : 'ltr'}` AND CSS classes (`.rtl .ant-*`). This dual approach can cause conflicts. Known issues exist with Table fixed columns, Badge, Collapse icons in RTL mode.

**Known Ant Design 5.x RTL bugs (as of 5.24.x):**
- Table fixed columns: Shadow doesn't appear, must use `fixed: 'right'` for left side
- Badge: Doesn't move correctly in RTL
- Collapse/Sider: Expand icons point wrong direction
- Image.PreviewGroup: Prev/next icons reversed
- Count suffix: Wrong direction in Input and Image components

**Consequences:**
- Hebrew users can't use the application effectively
- Professional credibility damaged
- Unusable UI elements
- User complaints and support burden

**Prevention:**
1. **Standardize on ConfigProvider ONLY** (remove CSS overrides that duplicate):
   ```tsx
   // App.tsx - keep this
   <ConfigProvider
     locale={antdLocale}
     direction={isRTL ? 'rtl' : 'ltr'}
     theme={{...}}
   >
   ```

2. **Use CSS only for components with known bugs** (targeted fixes):
   ```css
   /* App.css - keep only fixes for actual bugs, remove generic overrides */

   /* FIX: Table fixed columns shadow in RTL */
   .rtl .ant-table-cell-fix-left,
   .rtl .ant-table-cell-fix-right {
     /* Add shadow manually since Ant Design doesn't */
     box-shadow: inset -10px 0 8px -8px rgba(0, 0, 0, 0.15);
   }

   /* FIX: Collapse arrow direction */
   .rtl .ant-collapse-arrow {
     transform: rotate(180deg);
   }
   ```

3. **Create RTL regression test checklist**:
   ```markdown
   Before any PR:
   - [ ] Tested in Hebrew locale
   - [ ] Table columns display correctly (including fixed columns)
   - [ ] Form labels align right
   - [ ] Icons point correct direction
   - [ ] Modal/Drawer headers RTL
   - [ ] Dropdowns open in correct position
   ```

4. **Set document direction on language change**:
   ```tsx
   // Ensure i18n direction change updates document
   useEffect(() => {
     document.documentElement.dir = i18n.dir(i18n.language);
     document.documentElement.lang = i18n.language;
   }, [i18n.language]);
   ```

**Detection:**
- Visual inspection in Hebrew mode shows misaligned elements
- Users report "Hebrew mode is broken"
- CSS specificity wars (multiple `!important` declarations)
- Playwright visual regression tests fail

**Phase to address:** Phase 10-06 (RTL/Hebrew Fixes)

**Sources:**
- [Ant Design RTL issues #40090](https://github.com/ant-design/ant-design/issues/40090) (Badge)
- [Ant Design RTL issues #52942](https://github.com/ant-design/ant-design/issues/52942) (Table fixed columns)
- [Ant Design RTL issues #52371](https://github.com/ant-design/ant-design/issues/52371) (Collapse icons)
- [i18next RTL setup](https://github.com/i18next/next-i18next/discussions/1738)

---

### CP-05: Archive Extraction Memory Exhaustion

**What goes wrong:** Processing large archives (ZIP, TAR, GZIP) causes OutOfMemoryException. Service pods get OOMKilled. Nested archives multiply the problem.

**Why it happens:** .NET ZipArchive loads entire content to MemoryStream when opened in Update mode or with non-seekable streams. Nested archive extraction compounds memory usage exponentially.

**Root cause in EZ Platform context:** FileProcessor currently handles files up to 1GB (`maxFileSizeMB: "1000"` in values.yaml). Archive files containing many large files could easily exceed the 8GB memory limit.

**Consequences:**
- Pod crashes during legitimate file processing
- Other requests on same pod affected
- Kubernetes restarts pod, same file retries, crash loop
- User files get "stuck" in processing

**Prevention:**
1. **Use streaming extraction (never Update mode)**:
   ```csharp
   // GOOD - streaming extraction
   using var archive = new ZipArchive(inputStream, ZipArchiveMode.Read);
   foreach (var entry in archive.Entries)
   {
       using var entryStream = entry.Open();
       // Process entry stream directly, don't buffer
       await ProcessEntryStreamAsync(entryStream, entry.Name);
   }

   // BAD - loads to memory
   using var archive = new ZipArchive(inputStream, ZipArchiveMode.Update);
   ```

2. **Limit nested archive depth**:
   ```csharp
   private const int MaxNestingDepth = 3;

   public async Task ExtractArchiveAsync(Stream stream, int currentDepth = 0)
   {
       if (currentDepth >= MaxNestingDepth)
       {
           throw new InvalidOperationException(
               $"Archive nesting depth {currentDepth} exceeds maximum {MaxNestingDepth}");
       }
       // ... extraction logic
       if (IsArchive(entry.Name))
       {
           await ExtractArchiveAsync(entryStream, currentDepth + 1);
       }
   }
   ```

3. **Set per-file and total extraction limits**:
   ```csharp
   private const long MaxSingleFileSizeBytes = 500 * 1024 * 1024; // 500MB
   private const long MaxTotalExtractionSizeBytes = 2L * 1024 * 1024 * 1024; // 2GB

   long totalExtracted = 0;
   foreach (var entry in archive.Entries)
   {
       if (entry.Length > MaxSingleFileSizeBytes)
       {
           _logger.LogWarning("Skipping oversized entry {Entry}: {Size}MB",
               entry.Name, entry.Length / (1024 * 1024));
           continue;
       }
       totalExtracted += entry.Length;
       if (totalExtracted > MaxTotalExtractionSizeBytes)
       {
           throw new InvalidOperationException("Total extraction size limit exceeded");
       }
   }
   ```

4. **Use SharpCompress for streaming multi-format support**:
   ```csharp
   // SharpCompress supports streaming for ZIP, TAR, GZIP, RAR, 7Z
   using var reader = ReaderFactory.Open(inputStream);
   while (reader.MoveToNextEntry())
   {
       if (!reader.Entry.IsDirectory)
       {
           using var entryStream = reader.OpenEntryStream();
           // Process stream
       }
   }
   ```

**Detection:**
- Pod OOMKilled events: `kubectl get events -n ez-platform | grep OOM`
- Memory spike in Grafana before crash
- Specific archive files consistently fail
- Works in dev (small files), fails in prod (large files)

**Phase to address:** Phase 10-08 (Archive Extraction)

**Sources:**
- [ZipArchive memory issues #59027](https://github.com/dotnet/runtime/issues/59027)
- [ZipArchive Update mode memory #1544](https://github.com/dotnet/runtime/issues/1544)
- [SharpCompress streaming usage](https://github.com/adamhathcock/sharpcompress/blob/master/USAGE.md)

---

### CP-06: Helm Chart Air-Gapped Deployment Failures

**What goes wrong:** Helm install fails in air-gapped OCP environment. Missing images, missing dependencies, ImagePullBackOff errors.

**Why it happens:** Helm charts reference external registries. Image tags not fully qualified. Dependencies not packaged. ImageContentSourcePolicy not configured.

**Root cause in EZ Platform context:** The helm chart uses `imageRegistry: docker.io` by default. Air-gapped environments can't reach docker.io. All images need to be mirrored and references updated.

**Consequences:**
- Production deployment blocked
- Customer deployment fails
- Emergency scramble to identify missing images
- Delayed go-live

**Prevention:**
1. **Create comprehensive image list**:
   ```bash
   # scripts/list-images.sh
   #!/bin/bash
   helm template ez-platform ./helm/ez-platform \
     --set global.imageRegistry=PLACEHOLDER \
     | grep "image:" \
     | sed 's/.*image: //' \
     | sort -u > images.txt

   # Expected output for EZ Platform:
   # PLACEHOLDER/ez-platform/filediscovery:v0.2.0
   # PLACEHOLDER/ez-platform/fileprocessor:v0.2.0
   # PLACEHOLDER/ez-platform/validation:v0.2.0
   # ... (9 microservices)
   # mongo:8.0
   # confluentinc/cp-kafka:7.5.0
   # confluentinc/cp-zookeeper:7.5.0
   # hazelcast/hazelcast:5.6
   # rabbitmq:3.12-management-alpine
   # ... (infrastructure)
   ```

2. **Package images for offline transfer**:
   ```bash
   # scripts/package-images.sh
   while read image; do
     docker pull $image
     docker save $image -o images/$(echo $image | tr '/:' '_').tar
   done < images.txt

   # Create single tarball
   tar -cvf ez-platform-images-v0.2.0.tar images/
   ```

3. **Create OCP ImageContentSourcePolicy**:
   ```yaml
   # helm/ez-platform-ocp/templates/image-content-source.yaml
   apiVersion: operator.openshift.io/v1alpha1
   kind: ImageContentSourcePolicy
   metadata:
     name: ez-platform-mirror
   spec:
     repositoryDigestMirrors:
     - mirrors:
       - {{ .Values.global.imageRegistry }}/ez-platform
       source: docker.io/ez-platform
     - mirrors:
       - {{ .Values.global.imageRegistry }}/library
       source: docker.io/library
   ```

4. **Include ALL transitive dependencies in values.yaml**:
   ```yaml
   # Don't forget infrastructure images
   mongodb:
     image: "{{ .Values.global.imageRegistry }}/mongo:8.0"  # Not just "mongo:8.0"
   kafka:
     image: "{{ .Values.global.imageRegistry }}/confluentinc/cp-kafka:7.5.0"
   ```

5. **Create offline deployment guide**:
   ```markdown
   # Air-Gapped Deployment Steps
   1. Transfer ez-platform-images-v0.2.0.tar to bastion host
   2. Load images to local registry:
      for f in images/*.tar; do
        docker load -i $f
        # Tag and push to internal registry
      done
   3. Update values.yaml: global.imageRegistry: internal-registry.example.com
   4. helm install ez-platform ./helm/ez-platform-ocp -f values-airgap.yaml
   ```

**Detection:**
- `ImagePullBackOff` errors in pod status
- Events showing "Failed to pull image"
- Pods stuck in `Pending` state
- Works in connected environment, fails in air-gapped

**Phase to address:** Phase 10-10 (Helm Packaging for OCP)

**Sources:**
- [OpenShift image mirroring](https://docs.openshift.com/container-platform/4.9/installing/installing-mirroring-installation-images.html)
- [oc-mirror plugin](https://zhimin-wen.medium.com/openshift-4-10-image-mirroring-for-airgap-environment-f6bed61ea719)
- [Helm air-gapped issues #8276](https://github.com/helm/helm/issues/8276)

---

## Moderate Pitfalls

Issues that cause significant rework or degraded functionality.

---

### MP-01: SignalR Redis Backplane Configuration Errors

**What goes wrong:** SignalR with Redis backplane fails to connect. Chrome returns 1011 socket error. Messages don't propagate between pods.

**Why it happens:** Redis connection string misconfigured. AbortOnConnectFail default true. Channel prefix conflicts.

**Prevention:**
```csharp
builder.Services.AddSignalR()
    .AddStackExchangeRedis(options =>
    {
        options.Configuration = ConfigurationOptions.Parse(redisConnectionString);
        options.Configuration.AbortOnConnectFail = false; // Critical!
        options.Configuration.ConnectRetry = 3;
        options.Configuration.ConnectTimeout = 5000;
    });
```

**Detection:**
- SignalR works with single pod, fails with multiple
- Redis connection errors in logs
- 1011 WebSocket errors in browser

**Phase to address:** Phase 10-04 (Device Health Monitoring)

**Sources:**
- [Redis backplane docs](https://learn.microsoft.com/en-us/aspnet/core/signalr/redis-backplane)
- [Redis backplane issues #58078](https://github.com/dotnet/aspnetcore/issues/58078)

---

### MP-02: External API (File-Simulator) Tight Coupling

**What goes wrong:** Tests fail when file-simulator is unavailable. Integration tests skip instead of providing useful feedback. Production code has no fallback when API is down.

**Why it happens:** Direct HTTP calls without circuit breaker. No mock/stub for testing. Hard-coded timeouts.

**Prevention:**
1. **Implement circuit breaker with Polly**:
   ```csharp
   services.AddHttpClient<IFileSimulatorClient>()
       .AddPolicyHandler(Policy.WrapAsync(
           // Circuit breaker
           Policy<HttpResponseMessage>
               .Handle<HttpRequestException>()
               .OrResult(r => !r.IsSuccessStatusCode)
               .CircuitBreakerAsync(5, TimeSpan.FromMinutes(1)),
           // Retry
           Policy<HttpResponseMessage>
               .Handle<HttpRequestException>()
               .WaitAndRetryAsync(3, retry => TimeSpan.FromSeconds(Math.Pow(2, retry))),
           // Timeout
           Policy.TimeoutAsync<HttpResponseMessage>(TimeSpan.FromSeconds(30))
       ));
   ```

2. **Create testable abstraction**:
   ```csharp
   public interface IFileSimulatorClient
   {
       Task<FileSimulatorResponse> GetFilesAsync(string deviceId);
       bool IsAvailable { get; }
   }

   // Production: HttpFileSimulatorClient
   // Tests: MockFileSimulatorClient
   ```

3. **Implement graceful degradation**:
   ```csharp
   public async Task<IEnumerable<FileInfo>> GetFilesAsync()
   {
       if (!_circuitBreaker.IsOpen && await _fileSimulator.IsAvailableAsync())
       {
           return await _fileSimulator.GetFilesAsync();
       }

       // Fallback: return cached data or empty set
       _logger.LogWarning("File simulator unavailable, using fallback");
       return await _cache.GetOrDefaultAsync("files", Enumerable.Empty<FileInfo>());
   }
   ```

**Detection:**
- 19 integration tests currently skip when file-simulator unavailable
- No fallback behavior, service fails hard
- Timeouts cause cascading failures

**Phase to address:** Phase 10-05 (File-Simulator Integration)

**Sources:**
- [Circuit breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- [Polly resilience patterns](https://github.com/App-vNext/Polly)

---

### MP-03: i18next RTL Direction Not Updating Dynamically

**What goes wrong:** Switching language from English to Hebrew doesn't update page direction. User must refresh to see RTL layout.

**Why it happens:** `document.documentElement.dir` not updated on language change. i18n.dir() not called reactively.

**Root cause in EZ Platform context:** The current App.tsx sets `dir` on Layout component but doesn't update document root on language change.

**Prevention:**
```tsx
// App.tsx - add useEffect for document direction
const App: React.FC = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  // Update document direction on language change
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
    document.body.className = isRTL ? 'rtl' : 'ltr';
  }, [isRTL, i18n.language]);

  // ... rest of component
};
```

**Detection:**
- Language switcher changes text but not layout direction
- Page requires refresh after language change
- CSS `:dir(rtl)` selectors don't apply

**Phase to address:** Phase 10-06 (RTL/Hebrew Fixes)

---

### MP-04: OTEL Metrics Using Wrong Instrument Types

**What goes wrong:** Metrics exist but don't provide useful insights. Latency tracked as counter instead of histogram. No bucket distribution visible.

**Why it happens:** Using Counter when Histogram needed. Not understanding metric cardinality implications.

**Root cause in EZ Platform context:** The deprecated `DataProcessingMetrics.cs` uses Prometheus-net which is being migrated to OTEL. During migration, instrument types might be mismatched.

**Prevention:**
```csharp
// Correct instrument types:
// - Counter: for things that only increase (requests, errors, bytes)
// - Histogram: for distributions (latency, file sizes, queue lengths)
// - Gauge: for current values (active connections, queue depth)

// Example from BusinessMetrics.cs - verify these are correct:
_processingDuration = meter.CreateHistogram<double>(
    "business_processing_duration_seconds",
    unit: "seconds",
    description: "Time to process files");

_activeJobs = meter.CreateObservableGauge<int>(
    "business_active_jobs",
    observeValue: () => _jobCounter,
    description: "Currently running jobs");
```

**Detection:**
- Grafana dashboards show flat lines for latency (should be distributions)
- Can't calculate percentiles (p50, p95, p99)
- Metrics flood from high-cardinality labels

**Phase to address:** Phase 10-02 (OTEL Verification)

---

### MP-05: NAS Device Form Breaking Existing Functionality

**What goes wrong:** Replacing NFS protocol dropdown with NAS device selection breaks existing data sources. Migration incomplete. Form validation inconsistent.

**Why it happens:** Schema change without backward compatibility. Missing migration for existing data. Form state management conflicts.

**Prevention:**
1. **Support both old and new schemas during transition**:
   ```typescript
   interface DataSourceConnection {
     // Old fields (deprecated, still supported for existing records)
     protocol?: 'NFS' | 'SMB' | 'SFTP' | 'FTP';

     // New fields
     nasDeviceId?: string;
     nasDevice?: NasDevice;

     // Common fields
     path: string;
   }
   ```

2. **Create data migration script**:
   ```typescript
   async function migrateNfsToNasDevice(dataSource: DataSource): Promise<void> {
     if (dataSource.connection.protocol && !dataSource.connection.nasDeviceId) {
       // Create NAS device from old protocol config
       const nasDevice = await createNasDeviceFromLegacy(dataSource.connection);
       dataSource.connection.nasDeviceId = nasDevice.id;
       // Keep old fields for rollback capability
     }
   }
   ```

3. **Form supports both modes**:
   ```tsx
   {dataSource.connection.nasDeviceId ? (
     <NasDeviceSelector value={dataSource.connection.nasDeviceId} />
   ) : (
     <ProtocolSelector
       value={dataSource.connection.protocol}
       deprecated
       migrationHint="Select a NAS device instead"
     />
   )}
   ```

**Detection:**
- Existing data sources fail to load
- Form shows blank where protocol was
- API returns 400 for old data format

**Phase to address:** Phase 10-07 (NAS Device Integration)

---

## Minor Pitfalls

Issues that cause minor inconvenience or technical debt.

---

### mP-01: CSS RTL Overrides Using !important Wars

**What goes wrong:** RTL styling becomes unmaintainable. Specificity conflicts. Hard to debug layout issues.

**Why it happens:** Adding `!important` to fix one issue, requiring more `!important` elsewhere.

**Current state in EZ Platform:** The App.css has extensive `.rtl` class overrides, many with `!important`. This is technical debt.

**Prevention:**
- Use CSS logical properties (padding-inline-start, margin-inline-end)
- Rely on ConfigProvider direction primarily
- Only add CSS fixes for documented Ant Design bugs
- Use CSS custom properties for direction-aware values

**Phase to address:** Phase 10-06 (RTL/Hebrew Fixes)

---

### mP-02: Translation Keys Missing Leading to English Fallback

**What goes wrong:** Some UI text appears in English even when Hebrew selected. Inconsistent user experience.

**Why it happens:** New features added without translation keys. i18next falls back to key or English.

**Prevention:**
```typescript
// Use extraction tool to find missing keys
// package.json script:
"i18n:check": "i18next-parser --config i18next-parser.config.js --fail-on-warnings"

// i18next-parser.config.js
module.exports = {
  failOnWarnings: true,
  locales: ['en', 'he'],
  output: 'src/i18n/locales/$LOCALE.json',
  // This will fail build if keys are missing
};
```

**Detection:**
- Mixed Hebrew/English in UI
- Console warnings about missing translation keys
- User reports "some parts are in English"

**Phase to address:** Phase 10-06 (RTL/Hebrew Fixes)

---

### mP-03: VERIFICATION.md Not Created for 4 Phases

**What goes wrong:** No proof that features work correctly. Regression during future changes. Knowledge lost about testing approach.

**Prevention:**
```markdown
# VERIFICATION.md template for each phase:

## Verification Summary
- **Phase:** [number-name]
- **Verified by:** [name]
- **Date:** [date]

## Test Results
### Unit Tests
- [ ] All passing: `dotnet test`

### Integration Tests
- [ ] All passing: `npm run test:integration`

### E2E Tests
- [ ] All passing: `npm run test:e2e`

### Manual Verification
- [ ] Feature X works as expected
- [ ] Feature Y works as expected

## Screenshots/Evidence
[Include relevant screenshots]

## Known Issues
[Document any known limitations]
```

**Phase to address:** All phases (create as part of completion)

---

## Technical Debt Patterns

Existing issues that compound with new features.

---

### TD-01: Deprecated DataProcessingMetrics Still in Use

**What it is:** Legacy Prometheus-net metrics class marked `[Obsolete]` but still used across services.

**Impact:** Two metric systems running in parallel. Duplicate metrics. Confusion about which to use.

**Migration path:**
1. Audit all usages of `DataProcessingMetrics`
2. Replace with `BusinessMetrics` equivalents
3. Update dashboards to use new metric names
4. Remove old class after verification

**Phase to address:** Phase 10-02 (OTEL Verification)

---

### TD-02: Dual RTL Implementation (ConfigProvider + CSS Classes)

**What it is:** RTL implemented via both Ant Design ConfigProvider AND extensive CSS class overrides.

**Impact:** Hard to maintain. Potential conflicts. Changes require updating both.

**Simplification path:**
1. Audit which CSS overrides are actually needed
2. Remove overrides that duplicate ConfigProvider behavior
3. Keep only fixes for documented Ant Design bugs
4. Document which CSS rules exist and why

**Phase to address:** Phase 10-06 (RTL/Hebrew Fixes)

---

## Integration Gotchas

Issues specific to integrating new features with existing EZ Platform.

---

### IG-01: SignalR + Existing MassTransit/Kafka Architecture

**Issue:** Platform already uses Kafka for async messaging. SignalR adds another real-time channel.

**Gotcha:** Don't duplicate Kafka events through SignalR. Use SignalR only for:
- Client notifications (browser needs real-time update)
- Status updates (progress bars, health indicators)

Don't use SignalR for:
- Service-to-service communication (use Kafka)
- Durable messages (SignalR is not persistent)

**Pattern:**
```csharp
// Consumer receives Kafka message
public class DeviceStatusConsumer : IConsumer<DeviceStatusChanged>
{
    private readonly IHubContext<DeviceHealthHub> _hubContext;

    public async Task Consume(ConsumeContext<DeviceStatusChanged> context)
    {
        // Process business logic
        await ProcessStatusChange(context.Message);

        // Notify connected clients via SignalR
        await _hubContext.Clients
            .Group($"device-{context.Message.DeviceId}")
            .SendAsync("StatusChanged", context.Message);
    }
}
```

---

### IG-02: Archive Extraction + Existing File Pipeline

**Issue:** Current pipeline assumes files are ready to process. Archives add extraction step.

**Gotcha:** Don't extract archives in-place on original path. Extraction creates temporary files that could trigger re-discovery.

**Pattern:**
```csharp
// Use dedicated extraction directory
var extractionPath = Path.Combine(_tempPath, Guid.NewGuid().ToString());
try
{
    await ExtractToAsync(archivePath, extractionPath);

    // Process extracted files
    foreach (var file in Directory.GetFiles(extractionPath, "*", SearchOption.AllDirectories))
    {
        await _fileProcessor.ProcessFileAsync(file);
    }
}
finally
{
    // Cleanup extraction directory
    Directory.Delete(extractionPath, recursive: true);
}
```

---

### IG-03: NAS Device Selection + Existing Form Validation

**Issue:** Existing data source form has complex validation. Adding NAS device changes validation flow.

**Gotcha:** NAS device selection should populate connection fields automatically, but existing validation expects manual entry.

**Pattern:**
```typescript
// When NAS device selected, populate connection fields
const onNasDeviceSelect = (device: NasDevice) => {
  form.setFieldsValue({
    connection: {
      nasDeviceId: device.id,
      host: device.host,
      port: device.port,
      protocol: device.protocol,
      // But keep user-editable fields
      path: form.getFieldValue(['connection', 'path']),
    }
  });

  // Re-run validation with new values
  form.validateFields(['connection']);
};
```

---

## Performance Traps

Issues that cause performance degradation.

---

### PT-01: SignalR Connection Storms After Deployment

**Issue:** Mass reconnection attempts after pod restart can overwhelm the service.

**Prevention:**
- Use exponential backoff in client reconnection
- Add jitter to prevent synchronized retries
- Implement connection throttling on server

```typescript
// Client: randomized backoff
.withAutomaticReconnect({
  nextRetryDelayInMilliseconds: (context) => {
    const baseDelay = Math.min(30000, Math.pow(2, context.previousRetryCount) * 1000);
    const jitter = Math.random() * 1000; // 0-1 second jitter
    return baseDelay + jitter;
  }
})
```

---

### PT-02: Archive Extraction Disk I/O Bottleneck

**Issue:** Extracting large archives to disk blocks other file processing.

**Prevention:**
- Use separate disk/volume for extraction temp files
- Implement extraction queue with concurrency limit
- Consider in-memory extraction for small archives only

---

## Security Mistakes

Security issues specific to this milestone.

---

### SM-01: SignalR Hub Authorization Bypass

**Issue:** SignalR hubs might bypass normal API authentication.

**Prevention:**
```csharp
[Authorize]
public class DeviceHealthHub : Hub
{
    public async Task SubscribeToDevice(string deviceId)
    {
        // Verify user has access to this device
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!await _authService.CanAccessDevice(userId, deviceId))
        {
            throw new HubException("Access denied");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, $"device-{deviceId}");
    }
}
```

---

### SM-02: Archive Extraction Path Traversal (Zip Slip)

**Issue:** Malicious archives can extract files outside intended directory.

**Prevention:**
```csharp
public void ExtractEntry(ZipArchiveEntry entry, string destinationDir)
{
    var destinationPath = Path.GetFullPath(
        Path.Combine(destinationDir, entry.FullName));

    // Verify destination is within intended directory
    if (!destinationPath.StartsWith(Path.GetFullPath(destinationDir) + Path.DirectorySeparatorChar))
    {
        throw new SecurityException($"Entry is outside destination directory: {entry.FullName}");
    }

    entry.ExtractToFile(destinationPath, overwrite: false);
}
```

---

## "Looks Done But Isn't" Checklist

Common incomplete implementations that pass initial review.

| Feature | Looks Done | Actually Done When |
|---------|------------|-------------------|
| SignalR Hub | Hub class exists | Works with multiple pods, handles reconnection, has authorization |
| OTEL Tracing | Configuration exists | All 9 services appear in Jaeger with connected spans |
| RTL Layout | ConfigProvider set | All components tested in Hebrew, no visual regressions |
| Archive Extraction | ZIP extraction works | Handles TAR, GZIP, nested archives, memory limits, path traversal prevention |
| NAS Device Form | Dropdown added | Migration exists, validation works, backward compatible |
| Helm Air-gap | Chart exists | All images listed, mirroring scripts work, tested in disconnected environment |
| i18n Complete | Translation files exist | No English fallback visible in Hebrew mode |

---

## Pitfall-to-Phase Mapping

| Phase | Primary Pitfalls | Secondary Pitfalls |
|-------|-----------------|-------------------|
| 10-02 OTEL Verification | CP-03, MP-04, TD-01 | |
| 10-04 Device Health (SignalR) | CP-01, CP-02, MP-01, PT-01, SM-01 | IG-01 |
| 10-05 File-Simulator Integration | MP-02 | |
| 10-06 RTL/Hebrew Fixes | CP-04, MP-03, mP-01, mP-02, TD-02 | |
| 10-07 NAS Device Integration | MP-05 | IG-03 |
| 10-08 Archive Extraction | CP-05, PT-02, SM-02 | IG-02 |
| 10-10 Helm Packaging | CP-06 | |

---

## Phase-Specific Research Flags

| Phase | Needs Deeper Research | Reason |
|-------|----------------------|--------|
| 10-04 (SignalR) | YES | Multiple configuration pitfalls, Redis backplane complexity, Kubernetes-specific issues |
| 10-06 (RTL) | MEDIUM | Known Ant Design bugs, but documented workarounds exist |
| 10-08 (Archive) | YES | Memory management complex, multiple format support, security implications |
| 10-10 (Helm OCP) | YES | Air-gapped deployment has many failure modes, needs validation testing |
| 10-02 (OTEL) | LOW | Well-documented patterns, existing configuration to verify |
| 10-05 (File-Simulator) | LOW | Standard API integration patterns |
| 10-07 (NAS Form) | LOW | Form changes, standard React patterns |

---

## Sources Summary

### Official Documentation
- [Microsoft Learn: SignalR scaling](https://learn.microsoft.com/en-us/aspnet/core/signalr/scale)
- [Microsoft Learn: SignalR Redis backplane](https://learn.microsoft.com/en-us/aspnet/core/signalr/redis-backplane)
- [OpenTelemetry .NET docs](https://opentelemetry.io/docs/languages/dotnet/)
- [Ant Design ConfigProvider](https://ant.design/components/config-provider/)

### GitHub Issues & Discussions
- [G-Research: SignalR on Kubernetes](https://www.gresearch.com/news/signalr-on-kubernetes/)
- [ZipArchive memory issues](https://github.com/dotnet/runtime/issues/59027)
- [Ant Design RTL issues](https://github.com/ant-design/ant-design/issues/40090)
- [OpenTelemetry missing traces](https://github.com/open-telemetry/opentelemetry-dotnet/issues/4074)

### Community Resources
- [NGINX Ingress WebSocket config](https://www.pumpingco.de/blog/using-signalr-in-kubernetes-behind-nginx-ingress/)
- [OpenShift air-gapped mirroring](https://zhimin-wen.medium.com/openshift-4-10-image-mirroring-for-airgap-environment-f6bed61ea719)
- [i18next RTL setup](https://github.com/i18next/next-i18next/discussions/1738)
