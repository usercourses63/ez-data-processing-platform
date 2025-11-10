# EZ Data Processing Platform - Frontend

React-based frontend application with TypeScript, Ant Design UI framework, and comprehensive RTL (Hebrew) support.

## Architecture

### Technology Stack

- **React 19** - UI framework
- **TypeScript 4.9** - Type safety
- **Ant Design 5.10** - UI component library with RTL support
- **React Router 6** - Client-side routing
- **React Query (TanStack Query)** - Server state management
- **i18next** - Internationalization (Hebrew/English)
- **Axios** - HTTP client
- **Monaco Editor** - Code editor integration
- **Vanilla JSON Editor** - JSON schema editing
- **SignalR** - Real-time updates
- **Recharts** - Data visualization

### Project Structure

```
Frontend/
├── public/
│   └── index.html              # HTML template with RTL support
├── src/
│   ├── components/             # Reusable components
│   │   ├── layout/            # Layout components (Header, Sidebar)
│   │   ├── datasource/        # Data source components
│   │   ├── schema/            # Schema builder components
│   │   └── metrics/           # Metrics configuration components
│   ├── pages/                 # Page components
│   │   ├── Dashboard.tsx
│   │   ├── datasources/       # Data source management pages
│   │   ├── schema/            # Schema management pages
│   │   ├── metrics/           # Metrics pages
│   │   ├── monitoring/        # System monitoring
│   │   ├── validation/        # Validation results
│   │   ├── invalid-records/   # Invalid records management
│   │   ├── ai-assistant/      # AI assistant chat
│   │   └── notifications/     # Notifications management
│   ├── services/              # API clients
│   │   ├── schema-api-client.ts
│   │   ├── metrics-api-client.ts
│   │   ├── dashboard-api-client.ts
│   │   └── invalidrecords-api-client.ts
│   ├── types/                 # TypeScript type definitions
│   │   └── schema-api.ts
│   ├── utils/                 # Utility functions
│   │   ├── schemaValidator.ts
│   │   ├── schemaAutoSuggest.ts
│   │   └── schemaExampleGenerator.ts
│   ├── hooks/                 # Custom React hooks
│   │   └── useRealtimeSchemaValidation.ts
│   ├── i18n/                  # Internationalization
│   │   ├── index.ts
│   │   └── locales/
│   │       ├── en.json        # English translations
│   │       └── he.json        # Hebrew translations
│   ├── App.tsx                # Main app component
│   ├── App.css                # Global styles with RTL support
│   ├── index.tsx              # Entry point
│   └── index.css              # Base styles
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── README.md                  # This file
```

## Key Features

### 1. Data Source Management
- Create, edit, and manage data sources
- Configure file polling and validation rules
- Schedule processing with cron expressions
- Test connections and preview data

### 2. Schema Management
- Visual JSON Schema 2020-12 builder
- Schema templates for quick start
- Regex pattern helper with Israeli patterns
- Real-time validation
- Schema versioning and publishing

### 3. Metrics Configuration
- Wizard-based metric creation
- Formula builder with visual editor
- PromQL expression support
- Alert rule configuration
- Dashboard widgets

### 4. Real-time Monitoring
- System health dashboard
- Live data processing metrics
- Invalid records tracking
- Performance monitoring

### 5. RTL Support
- Full Hebrew language support
- RTL layout for UI components
- LTR override for technical fields (code, formulas, patterns)
- Bilingual interface (Hebrew/English)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend services running (Schema Service, Metrics Service, etc.)

### Installation

```bash
cd Frontend
npm install
```

### Development

```bash
npm start
```

The application will start on http://localhost:3000

### Build

```bash
npm run build
```

Production build will be created in the `build/` directory.

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## Environment Variables

Create a `.env` file in the Frontend directory:

```env
REACT_APP_SCHEMA_API_URL=http://localhost:5001/api/v1/schema
REACT_APP_METRICS_API_URL=http://localhost:5002/api/v1/metrics
REACT_APP_DASHBOARD_API_URL=http://localhost:5003/api/v1/dashboard
REACT_APP_SIGNALR_HUB_URL=http://localhost:5001/hubs/schema
```

## Component Overview

### Layout Components

- **AppHeader** - Top navigation bar with language switcher
- **AppSidebar** - Side navigation menu
- **RegexHelperProvider** - Context provider for regex pattern helper

### Schema Components

- **SchemaManagementEnhanced** - Schema list and management
- **SchemaBuilderNew** - Visual schema builder
- **SchemaEditorPage** - Schema editing page
- **SchemaTemplateLibrary** - Pre-built schema templates
- **RegexHelperDialog** - Regex pattern builder and tester
- **VanillaJSONEditorWrapper** - JSON editor component

### Data Source Components

- **DataSourceList** - Data source list with search and filters
- **DataSourceFormEnhanced** - Create/edit data source
- **DataSourceDetailsEnhanced** - View data source details
- **DataSourceEditEnhanced** - Edit data source
- **CronHelperDialog** - Cron expression builder

### Metrics Components

- **MetricsConfigurationListEnhanced** - Metrics list
- **MetricConfigurationWizard** - Step-by-step metric creation
- **FormulaBuilder** - Visual formula builder
- **PromQLExpressionHelperDialog** - PromQL expression helper
- **AlertRuleBuilder** - Alert rule configuration
- **SchemaFieldSelector** - Field selector from schema

## Styling and Theming

### Global Styles

- Purple gradient background (mockup style)
- Custom Ant Design theme with primary color #3498db
- Gradient buttons and dark table headers
- RTL-aware spacing and alignment
- Custom scrollbar styles

### RTL Implementation

- Automatic RTL layout based on i18n language
- LTR override for technical fields using `.ltr-field` class
- Force LTR for code editors, formulas, and patterns
- RTL-specific CSS adjustments for Ant Design components

## API Integration

### Service Classes

- **SchemaApiClient** - Schema management API
- **MetricsApiClient** - Metrics configuration API
- **DashboardApiClient** - Dashboard and statistics API
- **InvalidRecordsApiClient** - Invalid records API

### Error Handling

- Axios interceptors for global error handling
- Hebrew and English error messages
- Retry logic for failed requests
- Loading and error states with React Query

## State Management

### React Query

- Server state caching
- Automatic background refetching
- Optimistic updates
- Mutation handling

### Local State

- React hooks (useState, useEffect, useReducer)
- Context API for global state (language, theme)

## Real-time Updates

### SignalR Integration

- Real-time schema validation results
- Live processing status updates
- Automatic UI refresh on data changes

## Development Guidelines

### Code Style

- TypeScript strict mode enabled
- Functional components with hooks
- ESLint configuration for React
- Consistent naming conventions

### Component Structure

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';

interface MyComponentProps {
  // Props definition
}

const MyComponent: React.FC<MyComponentProps> = ({ ...props }) => {
  const { t } = useTranslation();
  
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
};

export default MyComponent;
```

### Internationalization

```typescript
import { useTranslation } from 'react-i18next';

const { t, i18n } = useTranslation();

// Use translations
<h1>{t('dashboard.title')}</h1>

// Change language
i18n.changeLanguage('en');
```

## Performance Optimization

- Code splitting with React.lazy()
- Memoization with React.memo() and useMemo()
- Virtual scrolling for large lists
- Debouncing for search inputs
- Image lazy loading

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

When adding new features:

1. Create feature branch from `main`
2. Add TypeScript types
3. Include Hebrew and English translations
4. Test RTL layout
5. Add unit tests where appropriate
6. Update documentation

## License

Proprietary
