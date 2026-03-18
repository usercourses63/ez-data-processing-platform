# EZ Platform — E2E Test Framework

## Setup

```bash
cd src/Frontend
npm install
npx playwright install chromium
```

**Prerequisites:**
- EZ platform deployed in `ez-platform` namespace (`kubectl get pods -n ez-platform`)
- Port forwarding active: `powershell.exe -ExecutionPolicy Bypass -File scripts/start-port-forwards.ps1`
- Frontend accessible at http://localhost:7000
- File-simulator-suite running (for protocol/NAS tests)

## Running Tests

```bash
# All E2E tests (chromium)
npm run test:e2e

# Headed mode (visible browser)
npm run test:e2e:headed

# Interactive UI mode
npm run test:e2e:ui

# Specific suite by tag
npx playwright test --grep @P0
npx playwright test --grep @NAS
npx playwright test --grep @Pipeline

# Protocol tests (cross-cluster, sequential)
npx playwright test --project=protocols

# E2E validation (pipeline flow, sequential)
npx playwright test --project=e2e-validation

# View HTML report
npm run test:e2e:report
```

## Architecture

```
tests/e2e/
├── support/                          # NEW: Test infrastructure (Suite 1)
│   ├── index.ts                      # Re-exports test + expect with cleanup fixture
│   ├── fixtures/
│   │   └── cleanup-fixture.ts        # Auto-cleanup of created resources (TI-001)
│   └── helpers/
│       ├── ant-design-helpers.ts     # Ant Design RTL/tab/form workarounds (TI-002, TI-003)
│       └── pipeline-poller.ts        # Pipeline completion polling (TI-005)
├── helpers/                          # EXISTING: API clients and UI helpers
│   ├── ez-api-client.ts              # EZ backend REST API client (servers, NAS, files)
│   ├── ui-helpers.ts                 # UI interaction helpers (add server/NAS via UI)
│   ├── simulator-client.ts           # File-simulator-suite API client
│   └── test-data.ts                  # Test data loading (CSV, JSON, XML, Excel)
├── fixtures/                         # Test data files
│   ├── test-data.csv
│   ├── test-data.json
│   ├── test-data.xml
│   └── test-data.xlsx
├── protocols/                        # Protocol-specific tests (sequential)
│   ├── global-setup.ts
│   ├── global-teardown.ts
│   ├── ftp.spec.ts
│   ├── sftp.spec.ts
│   ├── kafka.spec.ts
│   ├── http-webdav.spec.ts
│   ├── s3.spec.ts
│   └── nas-nfs.spec.ts
├── e2e-validation/                   # Pipeline flow tests (sequential)
│   ├── pipeline-flow.spec.ts
│   ├── ui-workflows.spec.ts
│   ├── cross-feature.spec.ts
│   ├── negative-tests.spec.ts
│   └── ui-monitoring.spec.ts
├── *.spec.ts                         # Feature tests (parallel)
└── snapshots/                        # Visual regression baselines
```

## Key Patterns

### Auto-Cleanup Fixture
```typescript
import { test, expect } from '../support';

test('create and verify server', async ({ cleanup, request, page }) => {
  const server = await createAdminServer(request, { Name: 'Test', ... });
  cleanup.track('server', server.ID);  // Auto-deleted after test

  // ... test logic
});
```

### Ant Design Tab Interaction
```typescript
import { clickAntTab, selectAntOption } from '../support/helpers/ant-design-helpers';

// Click a tab (workaround for RTL click issue)
await clickAntTab(page, 'output');

// Select from async-loading dropdown
await selectAntOption(page, page.locator('#ServerType'), 'FTP');
```

### Pipeline Polling
```typescript
import { waitForPipelineActivity, triggerImmediatePoll } from '../support/helpers/pipeline-poller';

await triggerImmediatePoll(request, datasourceId);
const stats = await waitForPipelineActivity(request, datasourceId, { timeoutMs: 60000 });
expect(stats.totalFilesProcessed).toBeGreaterThanOrEqual(1);
```

## Best Practices

- **Selectors**: Prefer `data-testid`, `data-node-key`, `[id="..."]` over text content
- **No hard waits**: Use `waitForResponse()`, `waitForSelector()`, or pipeline poller — never `waitForTimeout()` in assertions
- **Cleanup**: Always use the cleanup fixture — never leave orphaned resources
- **Viewport**: Use `setWideViewport()` when testing tabs (RTL overflow at narrow widths)
- **PascalCase**: All API payloads use PascalCase matching backend convention
- **Hebrew**: Error messages in Hebrew by default; use i18n keys for assertions

## Knowledge Base

- Risk governance: `_bmad/tea/testarch/knowledge/risk-governance.md`
- Test quality DoD: `_bmad/tea/testarch/knowledge/test-quality.md`
- Test design: `_bmad-output/test-artifacts/test-design/test-design-qa.md`
- Project context: `_bmad-output/project-context.md`
