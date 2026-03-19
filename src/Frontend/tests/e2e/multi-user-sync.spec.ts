import { test, expect } from '@playwright/test';

test.describe('Multi-user CRUD sync via SignalR', () => {
  test.skip('EntityChanged event received after DataSource create', async ({ page }) => {
    // TODO: Implement — create DataSource via API, verify SignalR event arrives on page
  });

  test.skip('EntityChanged event received after DataSource update', async ({ page }) => {
    // TODO: Implement — update DataSource via API, verify list refreshes
  });

  test.skip('EntityChanged event received after NAS device update', async ({ page }) => {
    // TODO: Implement — update NAS device via API, verify list refreshes
  });

  test.skip('409 Conflict returned when Version mismatch on update', async ({ request }) => {
    // TODO: Implement — PUT with stale Version, expect 409
  });
});
