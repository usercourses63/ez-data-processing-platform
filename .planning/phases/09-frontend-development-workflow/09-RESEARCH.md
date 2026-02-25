# Phase 9: Frontend Development Workflow - Research

**Researched:** 2026-02-03
**Domain:** React 19 frontend tooling, testing, documentation, RTL support
**Confidence:** HIGH

## Summary

The EZ Platform frontend is a mature React 19 + TypeScript application using Vite, Ant Design 5, React Query, and i18next. The codebase already has:
- A Playwright E2E test framework with existing tests for datasources, metrics, invalid-records, and alerts
- Full Hebrew/RTL support with comprehensive i18n translations (1176-line he.json)
- Extensive CSS rules for RTL layout including `.ltr-field` class for technical content
- A Help page that loads markdown content and an AppHeader with Help button
- Integration with Docusaurus portal (already configured with baseUrl `/docs/` and Hebrew locale support)

The gaps to address are: component documentation (no Storybook or equivalent), limited E2E test coverage for schema management, Help button URL environment detection, and RTL visual regression testing.

**Primary recommendation:** Use MDX-based component documentation in Docusaurus (no Storybook needed), extend existing Playwright tests with visual regression screenshots, implement runtime environment detection for Help URLs.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Playwright | ^1.49.0 | E2E testing | Already in use, excellent RTL/i18n support |
| Vite | ^5.4.21 | Build tool | Already configured with chunking |
| i18next | ^23.5.1 | Internationalization | Full Hebrew translation coverage |
| Ant Design | ^5.10.0 | UI components | RTL support built-in via ConfigProvider |

### Documentation Tool Recommendation
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Docusaurus MDX | ^3.1.0 | Component docs | Already deployed, supports Hebrew, no new tooling |

### Supporting (For Visual Regression)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @playwright/test toHaveScreenshot | built-in | Visual regression | RTL screenshot comparison |
| playwright-test-coverage | ^0.4.0 | Coverage tracking | Optional for test metrics |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Docusaurus MDX | Storybook | Additional tooling/maintenance burden, not needed for docs-only approach |
| Docusaurus MDX | Ladle | Lighter than Storybook but still adds separate dev server |
| Playwright screenshots | Percy/Chromatic | Cost, CI integration complexity, not justified for manual RTL verification |

**Recommendation:** Do NOT add Storybook. Per user decision "Critical path components only" with "Full documentation," MDX pages in Docusaurus are sufficient and avoid new tooling.

## Architecture Patterns

### Existing Project Structure (Relevant to Phase)
```
src/Frontend/
├── src/
│   ├── components/
│   │   ├── datasource/      # Data source forms (target for docs)
│   │   │   ├── tabs/        # 7 form tabs including BasicInfoTab, ConnectionTab, SchemaTab
│   │   │   └── modals/      # Dialog components
│   │   ├── schema/          # Schema editor components (target for docs)
│   │   │   ├── RegexHelperDialog.tsx
│   │   │   ├── SchemaTemplateLibrary.tsx
│   │   │   └── VanillaJSONEditorWrapper.tsx
│   │   └── layout/          # App layout with Help button
│   │       ├── AppHeader.tsx   # Contains Help button (QuestionCircleOutlined)
│   │       └── AppFooter.tsx   # Contains documentation link
│   ├── pages/
│   │   ├── admin/tabs/      # NAS device tab (target for docs)
│   │   │   └── NasDevicesTab.tsx
│   │   └── help/            # Help page (loads markdown)
│   │       └── HelpPage.tsx
│   └── i18n/
│       └── locales/
│           ├── he.json      # 1176 lines, comprehensive Hebrew
│           └── en.json      # English translations
├── tests/
│   ├── e2e/
│   │   ├── datasource.spec.ts    # Existing: CRUD tests
│   │   ├── metrics.spec.ts       # Existing: metrics tests
│   │   ├── invalid-records.spec.ts
│   │   └── alerts.spec.ts
│   └── README.md            # Testing guide documentation
└── playwright.config.ts     # Configured for K8s port-forward (localhost:7000)
```

### Pattern 1: RTL Layout with LTR Technical Fields
**What:** Technical content (code, paths, URLs, regex) stays LTR even in Hebrew RTL mode
**When to use:** Any input displaying technical content
**Example:**
```tsx
// Source: src/Frontend/src/App.css lines 406-478
// CSS class .ltr-field forces LTR for technical inputs
<Input className="ltr-field" placeholder="192.168.1.1" />

// Technical content classes already defined:
// .ltr-field, .promql-field, .formula-field, .path-field, .url-field
// .monaco-editor, .jsonjoy-builder, .json-editor, .code-editor
```

### Pattern 2: i18n with useTranslation Hook
**What:** All UI text uses translation keys from he.json/en.json
**When to use:** Any user-facing text
**Example:**
```tsx
// Source: src/Frontend/src/components/datasource/tabs/BasicInfoTab.tsx
const BasicInfoTab: React.FC<BasicInfoTabProps> = ({ form, t }) => {
  return (
    <Form.Item
      name="name"
      label={t('datasources.fields.name')}
      rules={[{ required: true, message: t('errors.required') }]}
    >
      <Input placeholder="..." />
    </Form.Item>
  );
};
```

### Pattern 3: E2E Tests with Hebrew Selectors
**What:** Playwright tests use Hebrew text in selectors since app defaults to Hebrew
**When to use:** All E2E tests
**Example:**
```typescript
// Source: src/Frontend/tests/e2e/datasource.spec.ts
test('should display the data sources list', async ({ page }) => {
  // Hebrew text selector for page title
  await expect(page.getByText('ניהול מקורות נתונים')).toBeVisible();

  // Dual-language button selector pattern
  await page.getByRole('button', { name: /הוסף מקור נתונים חדש|הוסף/ }).click();
});
```

### Pattern 4: Environment-Aware Configuration
**What:** Runtime detection of environment for URL routing
**When to use:** Help button, documentation links
**Example (Recommended Implementation):**
```typescript
// Helper function for docs URL
const getDocsUrl = (path: string = ''): string => {
  const isDev = window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1';
  const baseUrl = isDev ? 'http://localhost:3000/docs' : '/docs';
  return path ? `${baseUrl}/${path}` : baseUrl;
};
```

### Anti-Patterns to Avoid
- **Build-time environment detection:** Use runtime detection for Help URLs (per user decision)
- **English-only E2E selectors:** App defaults to Hebrew, use Hebrew text in test selectors
- **Hardcoded documentation URLs:** Use environment detection pattern
- **Separate Storybook deployment:** Adds maintenance burden, use Docusaurus MDX instead

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component documentation | Custom docs site | Docusaurus MDX | Already deployed at /docs/, supports Hebrew |
| RTL screenshot comparison | Manual visual inspection | Playwright toHaveScreenshot | Pixel-level comparison, snapshot management |
| Hebrew date formatting | Custom date strings | date-fns with locale | Already uses date-fns |
| Form validation messages | Custom error display | Ant Design Form + i18n | Already integrated |
| Visual diff CI | Percy/Chromatic | Local Playwright snapshots | Per user decision, no CI E2E |

**Key insight:** Docusaurus portal already exists with Hebrew locale support. Adding MDX component documentation there is simpler than introducing Storybook.

## Common Pitfalls

### Pitfall 1: Storybook Overkill
**What goes wrong:** Adding Storybook for "component documentation" when only 3 component sets need docs
**Why it happens:** Storybook is the default answer but has significant setup/maintenance cost
**How to avoid:** Use Docusaurus MDX pages with embedded code examples and screenshots
**Warning signs:** Storybook config files proliferating, additional dev server to maintain

### Pitfall 2: E2E Tests with Mocked Backend
**What goes wrong:** Tests pass in CI but fail against real backend due to timing, data differences
**Why it happens:** Mocking seems easier than K8s port-forward setup
**How to avoid:** Per user decision, use real backend via port-forward (scripts/start-port-forwards.ps1)
**Warning signs:** Tests use `mock()` or MSW handlers, flaky tests only in CI

### Pitfall 3: RTL Testing Without Direction Assertion
**What goes wrong:** Page renders but RTL layout is broken, tests still pass
**Why it happens:** Tests check text presence but not visual layout
**How to avoid:** Include `document.dir === 'rtl'` assertions plus visual regression screenshots
**Warning signs:** RTL bugs reported after tests pass

### Pitfall 4: Hardcoded Help URLs
**What goes wrong:** Help button works in dev but 404s in production or vice versa
**Why it happens:** Using environment variables at build time instead of runtime detection
**How to avoid:** Check `window.location.hostname` at runtime per user decision
**Warning signs:** Different builds needed for different environments

### Pitfall 5: English-First E2E Tests
**What goes wrong:** Tests break when Hebrew translations change
**Why it happens:** Writing tests in English when app defaults to Hebrew
**How to avoid:** Use Hebrew text in selectors (app's default language) OR use data-testid attributes
**Warning signs:** Tests written with English text that doesn't appear in default app state

## Code Examples

### Example 1: Help Button with Runtime URL Detection
```tsx
// Source: Recommended implementation for AppHeader.tsx
// Based on existing pattern in src/Frontend/src/components/layout/AppHeader.tsx

const getDocsUrl = (): string => {
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  return isDev ? 'http://localhost:3000/docs' : '/docs';
};

// In AppHeader component (already has QuestionCircleOutlined icon at line 9)
<Tooltip title={isRTL ? 'עזרה' : 'Help'}>
  <Button
    type="text"
    icon={<QuestionCircleOutlined />}
    onClick={() => window.open(getDocsUrl(), '_blank')}
  />
</Tooltip>
```

### Example 2: Playwright RTL Visual Regression Test
```typescript
// Source: Playwright documentation + project patterns
import { test, expect } from '@playwright/test';

test.describe('RTL Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Verify RTL mode is active
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
  });

  test('data source form renders correctly in RTL', async ({ page }) => {
    await page.getByRole('button', { name: /הוסף מקור נתונים חדש|הוסף/ }).click();
    await page.waitForLoadState('networkidle');

    // Visual snapshot comparison
    await expect(page).toHaveScreenshot('datasource-form-rtl.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.02  // 2% tolerance for font rendering differences
    });
  });
});
```

### Example 3: Component Documentation MDX in Docusaurus
```mdx
---
sidebar_position: 1
title: Data Source Form Components
---

# Data Source Form Components

## BasicInfoTab

Core information tab for data source creation.

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| form | FormInstance | Yes | Ant Design form instance |
| t | TFunction | Yes | i18n translation function |

### RTL Example

<div style={{display: 'flex', gap: '20px'}}>
  <div>
    <strong>LTR</strong>
    <img src="/img/components/basic-info-ltr.png" alt="BasicInfoTab LTR" />
  </div>
  <div>
    <strong>RTL (Hebrew)</strong>
    <img src="/img/components/basic-info-rtl.png" alt="BasicInfoTab RTL" />
  </div>
</div>

### Do's and Don'ts

- **Do:** Use `t()` function for all user-facing text
- **Do:** Add `.ltr-field` class to technical input fields (paths, URLs, regex)
- **Don't:** Hardcode Hebrew strings directly in JSX
- **Don't:** Use `text-align: right` directly - use RTL layout context instead
```

### Example 4: RTL Layout Assertion Test
```typescript
// Source: Playwright best practices for layout testing
test('should have correct RTL layout attributes', async ({ page }) => {
  await page.goto('/datasources');
  await page.waitForLoadState('networkidle');

  // Check document direction
  const htmlDir = await page.evaluate(() => document.documentElement.dir);
  expect(htmlDir).toBe('rtl');

  // Check body text alignment
  const bodyAlign = await page.evaluate(() =>
    getComputedStyle(document.body).textAlign
  );
  expect(bodyAlign).toBe('right');

  // Check table header alignment
  const thAlign = await page.locator('.ant-table-thead th').first().evaluate(
    el => getComputedStyle(el).textAlign
  );
  expect(thAlign).toBe('right');
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CRA (Create React App) | Vite | Already migrated | Fast HMR, better DX |
| Storybook for all components | Docs for critical paths only | This phase | Reduced maintenance |
| Mock backend in E2E | Real backend via port-forward | Established pattern | More realistic tests |
| Build-time env vars | Runtime hostname detection | This phase | Single build artifact |

**Current in codebase:**
- React 19.0.0 with Suspense for lazy loading (App.tsx line 19-35)
- Vite 5.4.21 with code splitting (vite.config.ts)
- Playwright 1.49.0 for E2E (package.json)
- Docusaurus 3.1.0 for documentation (release-package/docs-docusaurus)

## Existing Assets Inventory

### E2E Tests - Current Coverage
| File | Coverage | Status |
|------|----------|--------|
| datasource.spec.ts | CRUD, connection testing | Comprehensive |
| metrics.spec.ts | Metric config, dashboard | Comprehensive |
| invalid-records.spec.ts | Record management | Exists |
| alerts.spec.ts | Alert configuration | Exists |
| **schema.spec.ts** | **Missing** | **Needed for FE-02** |

### Critical Components for Documentation (FE-01)
| Component | Location | Priority |
|-----------|----------|----------|
| BasicInfoTab | src/components/datasource/tabs/ | High |
| ConnectionTab | src/components/datasource/tabs/ | High |
| SchemaTab | src/components/datasource/tabs/ | High |
| SchemaEditorPage | src/pages/schema/ | High |
| VanillaJSONEditorWrapper | src/components/schema/ | High |
| NasDevicesTab | src/pages/admin/tabs/ | High |

### RTL Support - Already Implemented
| Feature | File | Status |
|---------|------|--------|
| ConfigProvider direction | App.tsx line 75 | Complete |
| .ltr-field CSS class | App.css lines 406-478 | Complete |
| Hebrew translations | i18n/locales/he.json | 1176 lines, comprehensive |
| RTL table styling | App.css lines 222-241 | Complete |
| RTL form styling | App.css lines 244-268 | Complete |

### Documentation Portal - Current State
| Feature | Status | Notes |
|---------|--------|-------|
| Docusaurus deployment | Complete | release-package/docs-docusaurus/ |
| Hebrew locale config | Complete | docusaurus.config.js lines 29-45 |
| User guide in Hebrew | Complete | docs/user-guide-he.md |
| baseUrl: /docs/ | Complete | Consistent path |
| Local search | Complete | @easyops-cn/docusaurus-search-local |

## Gaps to Address

### Gap 1: Schema E2E Tests (FE-02)
**Current:** No schema.spec.ts exists
**Required:** E2E tests for schema validation management
**Effort:** New file following existing patterns

### Gap 2: Component Documentation (FE-01)
**Current:** No component docs exist
**Required:** MDX docs for data source forms, schema editor, NAS device tab
**Effort:** Create MDX files in Docusaurus, take LTR/RTL screenshots

### Gap 3: Help Button URL Detection (FE-06, FE-07)
**Current:** AppHeader Help button navigates to `/help` (loads markdown)
**Required:** Open Docusaurus portal `/docs` with runtime env detection
**Effort:** Modify AppHeader.tsx onClick handler

### Gap 4: RTL Visual Regression (FE-05)
**Current:** No screenshot comparison tests
**Required:** Playwright toHaveScreenshot for RTL layouts
**Effort:** Add to existing test files or create rtl-visual.spec.ts

### Gap 5: API Coordination Process (FE-03)
**Current:** No documented process
**Required:** Document frontend/backend API change workflow
**Effort:** Create MDX doc in Docusaurus

## Open Questions

### 1. Docusaurus Dev Server Port
**What we know:** Docusaurus defaults to port 3000
**What's unclear:** Per user decision, Help should link to localhost:3000 in dev
**Recommendation:** Verify Docusaurus runs on 3000, update if different

### 2. Component Screenshot Generation
**What we know:** Need LTR/RTL side-by-side screenshots for docs
**What's unclear:** Manual screenshots vs automated Playwright capture
**Recommendation:** Use Playwright to generate screenshots, then embed in MDX

## Sources

### Primary (HIGH confidence)
- `src/Frontend/package.json` - Dependencies and versions
- `src/Frontend/playwright.config.ts` - E2E test configuration
- `src/Frontend/src/App.tsx` - React 19 patterns, RTL ConfigProvider
- `src/Frontend/src/App.css` - RTL styling, .ltr-field class
- `src/Frontend/tests/e2e/*.spec.ts` - Existing test patterns
- `release-package/docs-docusaurus/docusaurus.config.js` - Portal configuration

### Secondary (MEDIUM confidence)
- `src/Frontend/tests/README.md` - Testing guide documentation
- `src/Frontend/src/i18n/locales/he.json` - Translation coverage

### Tertiary (LOW confidence)
- Playwright visual comparison API - verify toHaveScreenshot options

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already in use, versions verified
- Architecture: HIGH - Patterns extracted from existing codebase
- Pitfalls: HIGH - Based on codebase analysis and user decisions

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable frontend stack)
