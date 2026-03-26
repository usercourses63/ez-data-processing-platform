---
sidebar_position: 1
title: Component Library
description: Frontend component documentation with props, usage examples, and RTL support
last_verified: 2026-02-03
---

# Component Library

This section documents the critical path frontend components of EZ Platform. Each component includes:

- **Props Table** - Complete API reference with types and defaults
- **Usage Examples** - Code snippets showing common patterns
- **RTL/LTR Screenshots** - Visual comparison for bidirectional support
- **Do's and Don'ts** - Best practices for component usage

## Component Categories

### Data Source Forms

Form components used in the data source creation and editing workflow.

| Component | Purpose | Location |
|-----------|---------|----------|
| [BasicInfoTab](/docs/components/datasource-forms#basicinfotab) | Name, category, description fields | `/datasources/tabs/` |
| [ConnectionTab](/docs/components/datasource-forms#connectiontab) | Protocol and server selection | `/datasources/tabs/` |
| [SchemaTab](/docs/components/datasource-forms#schematab) | JSON Schema configuration | `/datasources/tabs/` |

### Schema Editor

Components for JSON Schema editing and validation.

| Component | Purpose | Location |
|-----------|---------|----------|
| [SchemaEditorPage](/docs/components/schema-editor#schemaeditorpage) | Full-page schema editing | `/pages/schema/` |
| [VanillaJSONEditorWrapper](/docs/components/schema-editor#vanillajsoneditorwrapper) | JSON editor integration | `/components/schema/` |

### Administration

Admin panel components for system configuration.

| Component | Purpose | Location |
|-----------|---------|----------|
| [NasDevicesTab](/docs/components/nas-devices#nasdevicestab) | NAS device management | `/admin/tabs/` |

### Monitoring

Real-time monitoring and device health components.

| Component | Purpose | Location |
|-----------|---------|----------|
| [System Monitoring](/docs/components/system-monitoring) | Real-time dashboard with SignalR integration | `/pages/monitoring/` |
| [Device Health](/docs/components/device-health) | NAS and AdminServer health monitoring | `/pages/monitoring/components/` |

## Design Principles

### RTL-First Design

All components are designed with RTL (Right-to-Left) support as a primary concern:

```tsx
// Technical fields stay LTR even in RTL mode
<Input className="ltr-field" placeholder="/path/to/files" />

// Regular text fields follow document direction
<Input placeholder="Enter name" />
```

### Form Integration

Components integrate with Ant Design Form through FormInstance:

```tsx
interface TabProps {
  form: FormInstance;
  t: (key: string) => string;  // i18n translation function
}
```

### Query-Based Data Fetching

Components use TanStack Query for server state:

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['categories', 'active'],
  queryFn: () => getAllCategories(false),
});
```

## Quick Reference

### Common Props Pattern

Most tab components follow this pattern:

```typescript
interface TabComponentProps {
  form: FormInstance;           // Ant Design form instance
  t: (key: string) => string;   // Translation function
  // ... component-specific props
}
```

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.ltr-field` | Force LTR direction for technical content |
| `.rtl-field` | Force RTL direction (rarely needed) |

### Form Validation

Components use Ant Design's form validation rules:

```tsx
<Form.Item
  name="name"
  rules={[
    { required: true, message: t('errors.required') },
    { min: 2, message: 'Minimum 2 characters' },
    { max: 100, message: 'Maximum 100 characters' }
  ]}
>
  <Input />
</Form.Item>
```

## File Locations

```
src/Frontend/src/
  components/
    datasource/
      tabs/
        BasicInfoTab.tsx      # Basic info form tab
        ConnectionTab.tsx     # Connection settings tab
        SchemaTab.tsx         # Schema configuration tab
    schema/
      VanillaJSONEditorWrapper.tsx  # JSON editor wrapper
  pages/
    admin/
      tabs/
        NasDevicesTab.tsx     # NAS device management
    schema/
      SchemaEditorPage.tsx    # Full-page schema editor
```

## Dependencies

The component library relies on these key dependencies:

| Package | Version | Purpose |
|---------|---------|---------|
| `antd` | 5.x | UI component library |
| `@tanstack/react-query` | 5.x | Server state management |
| `react-router-dom` | 6.x | Navigation |
| `i18next` | 23.x | Internationalization |
| `vanilla-jsoneditor` | 0.23.x | JSON editing |
| `jsonjoy-builder` | - | JSON Schema building |

## See Also

- [Hebrew User Guide](/docs/user-guide/) - End-user documentation
- [Architecture](/docs/architecture/system-architecture) - System architecture
- [Admin Guide](/docs/admin) - Administration reference
