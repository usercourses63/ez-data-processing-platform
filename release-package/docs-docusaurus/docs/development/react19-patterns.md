---
sidebar_position: 3
title: React 19 Patterns
---

# React 19 Patterns in EZ Platform

Patterns and best practices for React 19 development in EZ Platform.

## Overview

EZ Platform uses React 19.0.0 with the following stack:

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.0.0 | UI framework |
| Vite | 5.4 | Build tooling |
| Ant Design | 5.x | UI component library |
| React Query | 5.x (TanStack) | Server state management |
| i18next | 23.x | Internationalization |
| React Router | 6.x | Client-side routing |

## Core Patterns

### 1. Lazy Loading with Suspense

EZ Platform uses route-level code splitting for optimal initial load performance.

```tsx
// src/Frontend/src/App.tsx
import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LoadingState } from './components/shared';

// Lazy load page components
const DataSourceList = lazy(() => import('./pages/datasources/DataSourceList'));
const SchemaManagement = lazy(() => import('./pages/schema/SchemaManagementEnhanced'));
const SchemaEditorPage = lazy(() => import('./pages/schema/SchemaEditorPage'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

function App() {
  return (
    <Suspense fallback={<LoadingState type="page" />}>
      <Routes>
        <Route path="/datasources" element={<DataSourceList />} />
        <Route path="/schema" element={<SchemaManagement />} />
        <Route path="/schema/edit/:id" element={<SchemaEditorPage />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
      </Routes>
    </Suspense>
  );
}
```

**When to use lazy loading:**
- Page-level components (routes)
- Heavy components (Monaco editor, charts)
- Features not accessed on initial load
- Admin-only pages

**When NOT to use:**
- Small, frequently-used components
- Components in the critical rendering path
- Components used in render loops
- Layout components (header, sidebar, footer)

### 2. Translation Hook Pattern (i18next)

Hebrew/English support with the `useTranslation` hook:

```tsx
import { useTranslation } from 'react-i18next';

const DataSourceCard: React.FC<{ source: DataSource }> = ({ source }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  return (
    <Card title={source.name}>
      <p>{t('datasources.status')}: {t(`status.${source.status}`)}</p>
      <p>{t('datasources.lastRun')}: {source.lastRunTime}</p>
    </Card>
  );
};
```

**Translation key conventions:**

| Pattern | Example | Usage |
|---------|---------|-------|
| `page.title` | `datasources.title` | Page titles |
| `form.field.name` | `datasources.fields.name` | Form labels |
| `button.action` | `button.save`, `button.cancel` | Button text |
| `error.type` | `error.required`, `error.invalid` | Error messages |
| `status.value` | `status.active`, `status.inactive` | Status labels |

**Translation files location:**
- Hebrew: `src/Frontend/src/i18n/locales/he.json`
- English: `src/Frontend/src/i18n/locales/en.json`

### 3. Form State with Ant Design

Form handling using Ant Design Form component with TypeScript:

```tsx
import { Form, Input, Select, Button, message } from 'antd';
import { useTranslation } from 'react-i18next';

interface DataSourceFormValues {
  name: string;
  description?: string;
  connectionType: 'ftp' | 'sftp' | 'http' | 'kafka';
  isActive: boolean;
}

interface Props {
  initialValues?: Partial<DataSourceFormValues>;
  onSubmit: (values: DataSourceFormValues) => Promise<void>;
}

const DataSourceForm: React.FC<Props> = ({ initialValues, onSubmit }) => {
  const [form] = Form.useForm<DataSourceFormValues>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleFinish = async (values: DataSourceFormValues) => {
    setLoading(true);
    try {
      await onSubmit(values);
      message.success(t('datasources.saved'));
    } catch (error) {
      message.error(t('errors.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      initialValues={initialValues}
      onFinish={handleFinish}
      layout="vertical"
    >
      <Form.Item
        name="name"
        label={t('datasources.fields.name')}
        rules={[
          { required: true, message: t('errors.required') },
          { max: 100, message: t('errors.maxLength', { max: 100 }) },
        ]}
      >
        <Input placeholder={t('datasources.placeholders.name')} />
      </Form.Item>

      <Form.Item
        name="connectionType"
        label={t('datasources.fields.connectionType')}
        rules={[{ required: true, message: t('errors.required') }]}
      >
        <Select>
          <Select.Option value="ftp">{t('connectionTypes.ftp')}</Select.Option>
          <Select.Option value="sftp">{t('connectionTypes.sftp')}</Select.Option>
          <Select.Option value="http">{t('connectionTypes.http')}</Select.Option>
          <Select.Option value="kafka">{t('connectionTypes.kafka')}</Select.Option>
        </Select>
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={loading}>
        {t('button.save')}
      </Button>
    </Form>
  );
};
```

### 4. Server State with React Query

Data fetching, caching, and mutations with TanStack Query:

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataSourcesApiClient } from '../services/datasources-api-client';

// Query hook for fetching data
export const useDataSources = () => {
  return useQuery({
    queryKey: ['datasources'],
    queryFn: async () => {
      const response = await dataSourcesApiClient.getAll();
      if (response.isSuccess && response.data) {
        return response.data;
      }
      throw new Error(response.error?.messageEnglish || 'Failed to fetch');
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Mutation hook for creating data
export const useCreateDataSource = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dataSourcesApiClient.create,
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['datasources'] });
    },
  });
};

// Usage in component
const DataSourceList: React.FC = () => {
  const { data: sources, isLoading, error } = useDataSources();
  const createMutation = useCreateDataSource();

  if (isLoading) return <Spin />;
  if (error) return <Alert message={error.message} type="error" />;

  return (
    <List
      dataSource={sources}
      renderItem={(source) => (
        <List.Item>{source.name}</List.Item>
      )}
    />
  );
};
```

**Query key conventions:**
- `['datasources']` - List of data sources
- `['datasources', id]` - Single data source by ID
- `['datasources', { status: 'active' }]` - Filtered list
- `['schemas', id, 'usage']` - Nested resource

### 5. RTL Layout Pattern

Handling RTL (Right-to-Left) layouts for Hebrew:

```tsx
import { ConfigProvider } from 'antd';
import { useTranslation } from 'react-i18next';
import heIL from 'antd/locale/he_IL';
import enUS from 'antd/locale/en_US';

const App: React.FC = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const antdLocale = isRTL ? heIL : enUS;

  // Set document direction
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [isRTL, i18n.language]);

  return (
    <ConfigProvider
      locale={antdLocale}
      direction={isRTL ? 'rtl' : 'ltr'}
    >
      <Layout dir={isRTL ? 'rtl' : 'ltr'}>
        {/* App content */}
      </Layout>
    </ConfigProvider>
  );
};
```

### 6. Technical Fields (LTR Override)

Technical content (paths, URLs, regex, code) must remain LTR even in RTL mode:

```tsx
// CSS class for LTR technical fields
// Defined in App.css:
// .ltr-field { direction: ltr; text-align: left; }

// Usage in components
<Form.Item name="host" label={t('connection.host')}>
  <Input className="ltr-field" placeholder="192.168.1.1" />
</Form.Item>

<Form.Item name="path" label={t('connection.path')}>
  <Input className="ltr-field" placeholder="/data/input" />
</Form.Item>

<Form.Item name="regex" label={t('schema.regex')}>
  <Input className="ltr-field" placeholder="^[a-z0-9]+$" />
</Form.Item>

<Form.Item name="url" label={t('connection.url')}>
  <Input className="ltr-field" placeholder="https://api.example.com" />
</Form.Item>
```

**Fields requiring LTR:**
- IP addresses and hostnames
- File paths and URLs
- Regular expressions
- JSON/code snippets
- Email addresses
- Port numbers
- PromQL queries

## React 19 Specific Features

### useActionState (New in React 19)

For form submissions with built-in pending state:

```tsx
import { useActionState } from 'react';

const ContactForm: React.FC = () => {
  const [state, submitAction, isPending] = useActionState(
    async (previousState, formData: FormData) => {
      const name = formData.get('name') as string;
      const result = await saveContact({ name });
      return result;
    },
    null
  );

  return (
    <form action={submitAction}>
      <input name="name" />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
};
```

**Note:** EZ Platform primarily uses React Query for mutations due to its caching and invalidation features. `useActionState` is available for simpler form scenarios.

### use() Hook (New in React 19)

Reading promises and context in render:

```tsx
import { use, Suspense } from 'react';

// With promises
function DataSourceDetails({ dataPromise }: { dataPromise: Promise<DataSource> }) {
  const data = use(dataPromise);
  return <div>{data.name}</div>;
}

// With context
function ThemedButton() {
  const theme = use(ThemeContext);
  return <button style={{ color: theme.primary }}>Click</button>;
}
```

**Note:** React Query remains the preferred approach for data fetching in EZ Platform due to caching, refetching, and invalidation features.

## Anti-Patterns to Avoid

### 1. Direct document.dir Manipulation

```tsx
// BAD: Direct manipulation without React state
document.dir = 'rtl';

// GOOD: Use effect with language state
useEffect(() => {
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
}, [isRTL]);
```

### 2. Hardcoded Strings

```tsx
// BAD: Hardcoded Hebrew text
<Button>שמור</Button>
<Alert message="אנא מלא את כל השדות" />

// GOOD: Translation keys
<Button>{t('button.save')}</Button>
<Alert message={t('errors.fillAllFields')} />
```

### 3. Manual Data Fetching in useEffect

```tsx
// BAD: Manual fetch with useState
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  fetch('/api/datasources')
    .then(res => res.json())
    .then(setData)
    .finally(() => setLoading(false));
}, []);

// GOOD: React Query with proper caching
const { data, isLoading, error } = useQuery({
  queryKey: ['datasources'],
  queryFn: dataSourcesApiClient.getAll,
});
```

### 4. Prop Drilling Through Many Levels

```tsx
// BAD: Passing props through multiple components
<App user={user}>
  <Layout user={user}>
    <Sidebar user={user}>
      <UserMenu user={user} />
    </Sidebar>
  </Layout>
</App>

// GOOD: Use context or state management
<UserProvider value={user}>
  <App>
    <Layout>
      <Sidebar>
        <UserMenu /> {/* Gets user from context */}
      </Sidebar>
    </Layout>
  </App>
</UserProvider>
```

### 5. Missing Error Boundaries

```tsx
// BAD: No error handling
<App>
  <DataSourceList />
</App>

// GOOD: Error boundary for graceful failures
<ErrorBoundary fallback={<ErrorPage />}>
  <App>
    <DataSourceList />
  </App>
</ErrorBoundary>
```

### 6. Async Operations in Event Handlers Without Loading State

```tsx
// BAD: No loading feedback
const handleSave = async () => {
  await saveDataSource(values);
};

// GOOD: Loading state for user feedback
const [saving, setSaving] = useState(false);

const handleSave = async () => {
  setSaving(true);
  try {
    await saveDataSource(values);
    message.success(t('saved'));
  } catch (error) {
    message.error(t('saveFailed'));
  } finally {
    setSaving(false);
  }
};

<Button onClick={handleSave} loading={saving}>Save</Button>
```

## File Structure Conventions

```
src/Frontend/src/
├── components/           # Reusable UI components
│   ├── datasource/       # Data source specific
│   │   ├── tabs/         # Form tab components
│   │   └── modals/       # Modal dialogs
│   ├── schema/           # Schema editor components
│   ├── layout/           # App layout (header, sidebar, footer)
│   └── shared/           # Generic shared components
├── pages/                # Route page components (lazy loaded)
│   ├── datasources/      # Data source pages
│   ├── schema/           # Schema pages
│   ├── admin/            # Admin pages
│   └── help/             # Help pages
├── services/             # API clients
├── types/                # TypeScript interfaces
├── hooks/                # Custom React hooks
├── utils/                # Utility functions
├── api/                  # API-related utilities
└── i18n/                 # Internationalization
    └── locales/
        ├── he.json       # Hebrew translations
        └── en.json       # English translations
```

## Performance Considerations

### 1. Memoization

```tsx
// Memoize expensive computations
const sortedData = useMemo(() => {
  return data.sort((a, b) => a.name.localeCompare(b.name));
}, [data]);

// Memoize callbacks passed to children
const handleSelect = useCallback((id: string) => {
  setSelectedId(id);
}, []);
```

### 2. Virtual Lists for Large Data Sets

```tsx
import { List } from 'antd';
import VirtualList from 'rc-virtual-list';

<List>
  <VirtualList
    data={largeDataSet}
    height={400}
    itemHeight={47}
    itemKey="id"
  >
    {(item) => <List.Item>{item.name}</List.Item>}
  </VirtualList>
</List>
```

### 3. Image Optimization

```tsx
// Lazy load images
<img loading="lazy" src={imageUrl} alt={altText} />

// Use appropriate sizes
<img
  srcSet={`${smallUrl} 300w, ${mediumUrl} 600w, ${largeUrl} 1200w`}
  sizes="(max-width: 600px) 300px, (max-width: 1200px) 600px, 1200px"
/>
```

## Testing Patterns

See [E2E Testing Documentation](/docs/testing/TESTING) for comprehensive testing guidance.

### Component Testing

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('submits form with valid data', async () => {
  const onSubmit = vi.fn();
  render(<DataSourceForm onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText(/name/i), 'My Source');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));

  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'My Source' })
  );
});
```

### RTL Testing

```tsx
test('displays correctly in RTL mode', () => {
  // Set language to Hebrew
  i18n.changeLanguage('he');

  render(<DataSourceForm />);

  expect(document.documentElement.dir).toBe('rtl');
  expect(screen.getByRole('form')).toHaveStyle({ direction: 'rtl' });
});
```
