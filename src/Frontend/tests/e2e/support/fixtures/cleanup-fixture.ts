/**
 * Auto-cleanup fixture for Playwright tests.
 * Tracks resources created during tests and deletes them in afterAll.
 *
 * Usage:
 *   import { test } from '../support/fixtures/cleanup-fixture';
 *   test('my test', async ({ cleanup, request }) => {
 *     const server = await createAdminServer(request, { ... });
 *     cleanup.track('server', server.ID);
 *     // ... test logic
 *     // server is auto-deleted after test
 *   });
 */
import { test as base, APIRequestContext } from '@playwright/test';
import { EZ_API_BASE } from '../../helpers/ez-api-client';

type ResourceType = 'server' | 'nasDevice' | 'datasource' | 'schema' | 'category';

interface TrackedResource {
  type: ResourceType;
  id: string;
}

const ENDPOINT_MAP: Record<ResourceType, string> = {
  server: '/api/v1/servers',
  nasDevice: '/api/v1/nasdevices',
  datasource: '/api/v1/datasources',
  schema: '/api/v1/schemas',
  category: '/api/v1/categories',
};

class CleanupTracker {
  private resources: TrackedResource[] = [];
  private request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }

  /** Track a resource for cleanup after test completes */
  track(type: ResourceType, id: string): void {
    this.resources.push({ type, id });
  }

  /** Delete all tracked resources in reverse order (LIFO) */
  async cleanAll(): Promise<void> {
    const errors: string[] = [];

    for (const resource of this.resources.reverse()) {
      const endpoint = ENDPOINT_MAP[resource.type];
      try {
        // Special handling: NAS devices need deprovisioning before delete
        if (resource.type === 'nasDevice') {
          await this.request.post(
            `${EZ_API_BASE}${endpoint}/${resource.id}/deprovision`,
            { data: {} }
          ).catch(() => { /* ignore deprovision errors */ });
        }

        const response = await this.request.delete(
          `${EZ_API_BASE}${endpoint}/${resource.id}`
        );

        if (!response.ok() && response.status() !== 404) {
          errors.push(
            `Failed to delete ${resource.type} ${resource.id}: ${response.status()}`
          );
        }
      } catch (err) {
        errors.push(`Error deleting ${resource.type} ${resource.id}: ${err}`);
      }
    }

    this.resources = [];

    if (errors.length > 0) {
      console.warn('[cleanup] Some resources failed to delete:', errors);
    }
  }
}

export const test = base.extend<{ cleanup: CleanupTracker }>({
  cleanup: async ({ request }, use) => {
    const tracker = new CleanupTracker(request);
    await use(tracker);
    await tracker.cleanAll();
  },
});

export { expect } from '@playwright/test';
