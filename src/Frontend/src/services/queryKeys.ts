// Centralized React Query key factory
// Provides type-safe, hierarchical query keys for consistent cache management

export const queryKeys = {
  // Data Sources
  datasources: {
    all: ['datasources'] as const,
    lists: () => [...queryKeys.datasources.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.datasources.lists(), { filters }] as const,
    details: () => [...queryKeys.datasources.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.datasources.details(), id] as const,
    connection: (id: string) => [...queryKeys.datasources.detail(id), 'connection'] as const,
  },

  // Metrics
  metrics: {
    all: ['metrics'] as const,
    lists: () => [...queryKeys.metrics.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.metrics.lists(), { filters }] as const,
    details: () => [...queryKeys.metrics.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.metrics.details(), id] as const,
    byDataSource: (dataSourceId: string) =>
      [...queryKeys.metrics.all, 'byDataSource', dataSourceId] as const,
    global: () => [...queryKeys.metrics.all, 'global'] as const,
    promql: (query: string) => [...queryKeys.metrics.all, 'promql', query] as const,
  },

  // Schemas
  schemas: {
    all: ['schemas'] as const,
    lists: () => [...queryKeys.schemas.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.schemas.lists(), { filters }] as const,
    details: () => [...queryKeys.schemas.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.schemas.details(), id] as const,
    templates: () => [...queryKeys.schemas.all, 'templates'] as const,
    usage: (id: string) => [...queryKeys.schemas.detail(id), 'usage'] as const,
  },

  // Invalid Records
  invalidRecords: {
    all: ['invalidRecords'] as const,
    lists: () => [...queryKeys.invalidRecords.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.invalidRecords.lists(), { filters }] as const,
    byDataSource: (dataSourceId: string) =>
      [...queryKeys.invalidRecords.all, 'byDataSource', dataSourceId] as const,
    stats: () => [...queryKeys.invalidRecords.all, 'stats'] as const,
  },

  // Alerts
  alerts: {
    all: ['alerts'] as const,
    lists: () => [...queryKeys.alerts.all, 'list'] as const,
    list: (filters?: any) => [...queryKeys.alerts.lists(), { filters }] as const,
    byMetric: (metricId: string) =>
      [...queryKeys.alerts.all, 'byMetric', metricId] as const,
  },

  // Categories
  categories: {
    all: ['categories'] as const,
    list: (activeOnly?: boolean) =>
      [...queryKeys.categories.all, { activeOnly }] as const,
  },

  // Dashboard
  dashboard: {
    overview: () => ['dashboard', 'overview'] as const,
    stats: () => ['dashboard', 'stats'] as const,
    recentActivity: () => ['dashboard', 'recentActivity'] as const,
  },

  // System
  system: {
    health: () => ['system', 'health'] as const,
    monitoring: () => ['system', 'monitoring'] as const,
  },
};

// Helper function to invalidate all queries for an entity
export const invalidateEntity = (queryClient: any, entity: 'datasources' | 'metrics' | 'schemas' | 'invalidRecords' | 'alerts' | 'categories') => {
  const entityKeys = queryKeys[entity];
  if ('all' in entityKeys) {
    return queryClient.invalidateQueries((entityKeys as any).all);
  }
};

// Helper function to invalidate lists for an entity
export const invalidateLists = (queryClient: any, entity: 'datasources' | 'metrics' | 'schemas' | 'invalidRecords' | 'alerts' | 'categories') => {
  const entityKeys = queryKeys[entity];
  if ('lists' in entityKeys) {
    return queryClient.invalidateQueries((entityKeys as any).lists());
  }
};
