# Phase 10: Feature Completion - Research

**Researched:** 2026-02-03
**Domain:** NAS/NFS Integration, Archive Extraction, E2E Testing, Documentation
**Confidence:** HIGH

## Summary

Phase 10 completes v0.2.0 feature work by integrating NAS devices into the datasource Connection tab, validating archive extraction E2E, implementing AdminServer CRUD tests, and completing documentation. The codebase already has substantial infrastructure:

1. **NAS device management is complete** - `NasDevice` entity, `NasDevicesController`, `NasDevicesTab.tsx`, and `NfsConnector` are fully implemented
2. **Archive extraction service exists** - `SharpCompressArchiveService` supports ZIP, TAR.GZ, RAR, 7Z with security controls
3. **AdminServer pattern established** - Frontend `ConnectionTab.tsx` shows the exact pattern for server selection dropdowns
4. **E2E test infrastructure ready** - Playwright configured with visual regression, file-simulator provides protocol servers

**Primary recommendation:** Add NAS as a protocol option in `ConnectionTab.tsx` following the existing AdminServer pattern, wire archive extraction through FileProcessor, and create E2E tests against file-simulator.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SharpCompress | Latest | Archive extraction (ZIP, TAR.GZ, RAR, 7Z) | Already integrated, supports all required formats |
| Playwright | Latest | E2E testing | Already configured with visual regression |
| Docusaurus | 3.x | Documentation portal | Already deployed, supports MDX and i18n |
| Ant Design | 5.x | UI components | Already used for forms, tables, RTL support |
| React Query | @tanstack/react-query | Server state | Established pattern for API calls |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| i18next | Latest | Hebrew translations | All new UI text must use `t()` function |
| Monaco Editor | Latest | Code editing in docs | Schema examples, configuration |
| Rubik Font | Web | Hebrew typography | All Hebrew text rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SharpCompress | System.IO.Compression | Only supports ZIP; SharpCompress already integrated for all formats |
| Playwright | Cypress | Playwright already configured with visual regression |

**Installation:** No new packages required - all libraries already in project.

## Architecture Patterns

### Existing NAS Device Entity Structure
```
src/Services/Shared/Entities/NasDevice.cs
├── Name, Description           # Display info
├── Host, Port, ExportPath      # NFS connection
├── Role (Input/Output/Both)    # Direction
├── PvName, PvcName, MountPath  # Computed K8s resources
├── IsPvCreated, IsPvcBound     # Provisioning status
└── LastConnectionTest/Success  # Health tracking
```

### Existing AdminServer Selection Pattern (ConnectionTab.tsx)
```typescript
// 1. Fetch servers filtered by protocol
const { data: inputServers } = useQuery({
  queryKey: serverQueryKeys.list('input'),
  queryFn: getInputServers,
});

// 2. Filter compatible servers for selected protocol
const compatibleServers = useMemo(() => {
  const serverType = protocolToServerType[connectionType];
  return inputServers.filter(s => s.ServerType === serverType);
}, [connectionType, inputServers]);

// 3. Render server dropdown
<Select name="inputServerId">
  {compatibleServers.map(server => (
    <Option key={server.ID} value={server.ID}>
      {server.Name} ({server.Host}:{server.Port})
    </Option>
  ))}
</Select>
```

### Pattern for NAS Integration (New)
```typescript
// When protocol === 'NAS':
// 1. Replace inputServerId with nasDeviceId
// 2. Fetch NAS devices instead of AdminServers
// 3. Show export dropdown for available NFS exports
// 4. Show sub-path input for path within export
// 5. Display mount status (mounted/unmounted)

const { data: nasDevices } = useQuery({
  queryKey: nasDeviceQueryKeys.list(),
  queryFn: () => getNasDevices(),
  enabled: connectionType === 'NAS',
});

// Filter to mounted, role-compatible devices
const availableNasDevices = nasDevices.filter(d =>
  d.IsProvisioned && d.IsActive && d.CanBeInput
);
```

### Archive Extraction Flow
```
FileDiscovery polls source
        │
        ▼
   File bytes fetched via connector
        │
        ▼
   FileProcessor receives bytes
        │
        ▼
   IArchiveService.IsArchive(fileName, bytes)
        │
        ├─── false ──► Process file directly
        │
        └─── true ───► IArchiveService.ExtractMatchingFilesAsync()
                              │
                              ▼
                       For each extracted file:
                         - Validate against schema
                         - Send to output destinations
```

### E2E Test Structure Pattern
```typescript
// tests/e2e/admin-server.spec.ts
test.describe('AdminServer Management', () => {
  test.describe('NAS Device CRUD', () => {
    test('should create NAS device', async ({ page }) => { ... });
    test('should edit NAS device', async ({ page }) => { ... });
    test('should test NAS connection', async ({ page }) => { ... });
    test('should delete NAS device', async ({ page }) => { ... });
  });

  test.describe('Server-Datasource Linking', () => {
    test('should create datasource with NAS server', async ({ page }) => { ... });
  });

  test.describe('Visual Regression RTL', () => {
    test('should capture NAS tab RTL baseline', async ({ page }) => {
      await expect(page).toHaveScreenshot('nas-devices-tab-rtl.png');
    });
  });
});
```

### Anti-Patterns to Avoid
- **Don't add NFS as separate protocol** - NAS replaces NFS conceptually; NFS is internal to NAS implementation
- **Don't skip archive validation** - Always enforce ArchiveSecuritySettings to prevent zip bombs
- **Don't use test.skip for file-simulator** - CI must fail if file-simulator unavailable
- **Don't machine-translate Hebrew docs** - Write native Hebrew content

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Archive extraction | Custom extraction logic | `IArchiveService` | SharpCompress handles all formats, includes security |
| Server dropdown | Custom fetch logic | `useQuery` with existing API clients | Pattern established in ConnectionTab.tsx |
| NAS device list | Manual API calls | `nas-devices-api-client.ts` | Full CRUD already implemented |
| Visual regression | Manual screenshot comparison | `toHaveScreenshot()` | Playwright handles diffing, thresholds |
| Hebrew translations | Inline Hebrew strings | `i18next` `t()` function | Maintains translation consistency |

**Key insight:** All infrastructure components exist. This phase is primarily integration and testing, not building new systems.

## Common Pitfalls

### Pitfall 1: NAS vs NFS Protocol Confusion
**What goes wrong:** Adding "NFS" as protocol option while NAS already exists
**Why it happens:** NasDevice uses NFS internally, but frontend should show "NAS" not "NFS"
**How to avoid:** User decision specifies NAS replaces NFS in dropdown; NFS is implementation detail
**Warning signs:** Protocol dropdown showing both NAS and NFS

### Pitfall 2: Archive Extraction in Wrong Service
**What goes wrong:** Implementing extraction in connector instead of FileProcessor
**Why it happens:** Temptation to have connector understand archives
**How to avoid:** Connectors just fetch bytes; FileProcessor detects and extracts archives
**Warning signs:** Archive-specific code in connectors, extraction logic duplicated

### Pitfall 3: E2E Tests Skipping When File-Simulator Down
**What goes wrong:** Tests pass in CI even though file-simulator is unavailable
**Why it happens:** Using `test.skip.if()` or conditional logic
**How to avoid:** CI must fail hard if file-simulator connectivity check fails at setup
**Warning signs:** Green CI with "skipped" tests, protocol tests never actually running

### Pitfall 4: NAS Device Change Not Clearing Path
**What goes wrong:** Changing NAS device but keeping old export/path which doesn't exist on new device
**Why it happens:** Form state not properly clearing dependent fields
**How to avoid:** User decision specifies: clear export/path if new device doesn't have compatible export
**Warning signs:** Connection test failing after device change with stale path

### Pitfall 5: Missing Hebrew Documentation Sections
**What goes wrong:** English-only documentation for new NAS/archive features
**Why it happens:** Developer focuses on English docs first, forgets Hebrew
**How to avoid:** User decision requires Hebrew user guide update with NAS/archive sections
**Warning signs:** user-guide-he.mdx not updated in PR

## Code Examples

Verified patterns from existing codebase:

### NAS Device Query (Frontend)
```typescript
// Source: src/Frontend/src/services/nas-devices-api-client.ts
export const getNasDevices = async (includeDeleted = false): Promise<NasDevice[]> => {
  const url = includeDeleted
    ? `${API_BASE_URL}/api/v1/nasdevices?includeDeleted=true`
    : `${API_BASE_URL}/api/v1/nasdevices`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(error.message || 'Error fetching NAS devices');
  }
  return response.json();
};
```

### Archive Detection (Backend)
```csharp
// Source: src/Services/Shared/Services/SharpCompressArchiveService.cs
public bool IsArchive(string fileName, byte[]? fileContent = null)
{
    return GetArchiveType(fileName, fileContent) != null;
}

public ArchiveType? GetArchiveType(string fileName, byte[]? fileContent = null)
{
    // Try magic bytes first if content provided
    if (fileContent != null && fileContent.Length >= 6)
    {
        foreach (var (archiveType, magicBytesArray) in MagicBytes)
        {
            foreach (var magic in magicBytesArray)
            {
                if (StartsWithBytes(fileContent, magic))
                    return archiveType;
            }
        }
    }

    // Fall back to extension detection
    var extension = Path.GetExtension(fileName).ToLowerInvariant();
    return ExtensionMap.GetValueOrDefault(extension);
}
```

### Archive Extraction with Security
```csharp
// Source: src/Services/Shared/Services/SharpCompressArchiveService.cs
public async Task<IReadOnlyDictionary<string, byte[]>> ExtractMatchingFilesAsync(
    byte[] archiveContent,
    string pattern,
    ArchiveType? archiveType = null,
    string? password = null,
    ArchiveSecuritySettings? settings = null,
    CancellationToken cancellationToken = default)
{
    settings ??= ArchiveSecuritySettings.Default;

    // List contents first to apply security checks
    var entries = await ListContentsAsync(archiveContent, archiveType, password, settings, cancellationToken);

    // Filter entries by pattern
    var matchingEntries = entries
        .Where(e => !e.IsDirectory && MatchesPattern(e.Path, pattern))
        .ToList();

    var result = new Dictionary<string, byte[]>();
    foreach (var entry in matchingEntries)
    {
        var content = await ExtractFileAsync(archiveContent, entry.Path, archiveType, password, settings, cancellationToken);
        result[entry.Path] = content;
    }

    return result;
}
```

### E2E Test Pattern (Playwright)
```typescript
// Source: src/Frontend/tests/e2e/datasource.spec.ts
test('should configure connection settings', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /הוסף מקור נתונים חדש|הוסף/ }).click();
  await page.waitForLoadState('networkidle');

  // Navigate to connection tab (Hebrew: "חיבור")
  const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
  if (await connectionTab.isVisible()) {
    await connectionTab.click();
  }

  // Select connection type
  const typeSelect = page.locator('.ant-select').first();
  await typeSelect.click();
  const option = page.getByRole('option', { name: /local|מקומי/i });
  await option.click();

  // Test connection
  const testBtn = page.getByRole('button', { name: /בדוק חיבור|test/i });
  await testBtn.click();
});
```

### RTL Visual Regression Pattern
```typescript
// Source: src/Frontend/tests/e2e/datasource.spec.ts
test('should capture connection tab RTL baseline', async ({ page }) => {
  await page.goto('/datasources/new');
  await page.waitForLoadState('networkidle');

  const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
  await connectionTab.click();
  await page.waitForTimeout(500);

  await expect(page).toHaveScreenshot('datasource-connection-tab-baseline.png', {
    fullPage: true,
    animations: 'disabled',
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual NFS path entry | NAS device dropdown | v0.2.0 Phase 2 | Users select from admin-configured NAS devices |
| Archive extraction in connectors | Centralized in FileProcessor | v0.2.0 Phase 2 | Single extraction point, easier maintenance |
| E2E tests skip on missing services | Hard fail on file-simulator unavailable | v0.2.0 Phase 10 | Ensures tests actually run in CI |
| NFS in protocol dropdown | NAS replaces NFS | v0.2.0 Phase 10 | Clearer user mental model |

**Deprecated/outdated:**
- `AdditionalConfiguration` on DataSource: Deprecated in v0.2.0, use `FileServerId` and AdminServer

## Open Questions

Things that couldn't be fully resolved:

1. **NAS Export Enumeration Implementation**
   - What we know: User decision says "Export dropdown shows available NFS exports"
   - What's unclear: How to query available exports from NAS device (K8s PVC enumeration vs NAS API)
   - Recommendation: Check if NasDeviceService has export enumeration; if not, use ExportPath as single export reference

2. **File Browser for NAS Paths**
   - What we know: User decision says "File browser works for NAS paths"
   - What's unclear: Whether NfsConnector.ListFilesAsync via AdminServer is sufficient
   - Recommendation: Verify NfsConnector implements file listing; may need new API endpoint

3. **Unmounted NAS Display**
   - What we know: User decision says "Unmounted NAS devices appear disabled with indicator"
   - What's unclear: Real-time mount status checking vs cached IsPvcBound status
   - Recommendation: Use `IsPvCreated && IsPvcBound` from NasDevice entity as mount status

## Sources

### Primary (HIGH confidence)
- `src/Services/Shared/Entities/NasDevice.cs` - NAS device entity structure
- `src/Services/Shared/Connectors/NfsConnector.cs` - NFS connector implementation
- `src/Services/Shared/Services/IArchiveService.cs` - Archive service interface
- `src/Services/Shared/Services/SharpCompressArchiveService.cs` - Archive implementation
- `src/Frontend/src/components/datasource/tabs/ConnectionTab.tsx` - Server selection pattern
- `src/Frontend/src/services/nas-devices-api-client.ts` - NAS API client
- `src/Frontend/tests/e2e/datasource.spec.ts` - E2E test patterns
- `src/Frontend/playwright.config.ts` - Playwright configuration

### Secondary (MEDIUM confidence)
- `docs/testing/file-simulator-setup.md` - File-simulator configuration
- `release-package/docs-docusaurus/docs/user-guide-he.mdx` - Hebrew documentation structure

### Tertiary (LOW confidence)
- None - all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use in codebase
- Architecture: HIGH - Patterns verified against existing implementations
- Pitfalls: HIGH - Derived from codebase structure and user decisions

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable domain)
