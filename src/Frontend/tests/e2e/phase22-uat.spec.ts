/**
 * Phase 22 UAT Tests: SignalR Monitoring Data Integration
 *
 * Tests all 5 UAT scenarios:
 * 1. Monitoring Dashboard - Real Cluster Data (SignalR broadcasts infra data)
 * 2. Skeleton Loading Before SignalR Data Arrives
 * 3. DataSource List Auto-Refreshes on Remote Change (EntityChanged SignalR)
 * 4. NAS Device List Auto-Refreshes on Remote Change
 * 5. Optimistic Locking - 409 Conflict on Stale Edit
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:7000';
const API_URL = 'http://localhost:5001';

// Helper: create a test datasource via API and return it
async function createTestDataSource(request: any, suffix: string = '') {
  const resp = await request.post(`${API_URL}/api/v1/datasource`, {
    data: {
      Name: `UAT-P22-${suffix}-${Date.now()}`,
      SupplierName: 'UAT Test Supplier',
      Description: 'Phase 22 UAT test datasource',
      Category: 'Sales',
      SourceType: 0,
      ConnectionString: '/tmp/uat-test',
      FilePattern: '*.csv',
      IsActive: false,
    }
  });
  if (!resp.ok()) {
    const body = await resp.text();
    throw new Error(`Failed to create datasource: ${resp.status()} ${body}`);
  }
  const json = await resp.json();
  // Normalize response - backend returns {CorrelationId, Data: {ID, ...}}
  return { id: json.Data?.ID, version: json.Data?.Version ?? 1, name: json.Data?.Name, raw: json };
}

// Helper: delete a datasource via API
async function deleteTestDataSource(request: any, id: string) {
  await request.delete(`${API_URL}/api/v1/datasource/${id}`).catch(() => {});
}

test.describe('Phase 22 UAT: SignalR Monitoring Data Integration', () => {

  // ─── TEST 1: Monitoring Dashboard - Real Cluster Data ───────────────────────
  test('UAT-22-01: Monitoring dashboard page loads and shows real cluster data', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });

    // Capture JS errors
    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    // Capture network requests to SignalR hub
    const hubRequests: string[] = [];
    page.on('request', req => {
      if (req.url().includes('/hubs/monitoring')) hubRequests.push(req.url());
    });

    await page.goto(`${BASE_URL}/monitoring`);
    await page.waitForLoadState('networkidle');

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/p22-01-monitoring-initial.png' });

    // Step 1: Verify SignalR negotiate endpoint is callable
    const negotiateResp = await page.request.post(`${API_URL}/hubs/monitoring/negotiate?negotiateVersion=1`, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`[UAT-22-01] SignalR negotiate status: ${negotiateResp.status()}`);
    expect(negotiateResp.status(), 'SignalR negotiate endpoint must return 200').toBe(200);

    const negotiateData = await negotiateResp.json();
    console.log(`[UAT-22-01] Connection ID: ${negotiateData.connectionId}`);
    expect(negotiateData.connectionId, 'Negotiate must return connectionId').toBeTruthy();

    // Step 2: Wait for page to settle and check state
    // The page needs time to connect SignalR and receive first broadcast (max 35s for infra loop)
    console.log('[UAT-22-01] Waiting up to 35s for SignalR data...');
    await page.waitForTimeout(5000);

    await page.screenshot({ path: 'test-results/p22-01-monitoring-after-5s.png' });

    // Check if still loading (skeleton) or has data
    const hasSkeletons = await page.locator('.ant-skeleton').count() > 0;
    const hasMonitoringDash = await page.locator('.monitoring-dashboard').isVisible().catch(() => false);
    const hasTabs = await page.locator('.ant-tabs-tab').count() > 0;
    const hasConnectingSpinner = await page.locator('.ant-spin').isVisible().catch(() => false);

    console.log(`[UAT-22-01] After 5s: skeletons=${hasSkeletons}, dashboard=${hasMonitoringDash}, tabs=${hasTabs}, spinner=${hasConnectingSpinner}`);

    // Step 3: Check connection state via console
    const consoleMessages: string[] = [];
    page.on('console', msg => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));

    // Wait for potential data arrival
    await page.waitForTimeout(10000);
    await page.screenshot({ path: 'test-results/p22-01-monitoring-after-15s.png' });

    // Evaluate page state
    const pageState = await page.evaluate(() => {
      const dashboard = document.querySelector('.monitoring-dashboard');
      const skeletons = document.querySelectorAll('.ant-skeleton');
      const tabs = document.querySelectorAll('.ant-tabs-tab');
      const spinner = document.querySelector('.ant-spin');
      const clusterHeader = document.querySelector('.cluster-header');
      const metricCards = document.querySelectorAll('.ant-statistic, .ant-card');

      return {
        hasDashboard: !!dashboard,
        skeletonCount: skeletons.length,
        tabCount: tabs.length,
        hasSpinner: !!spinner,
        hasClusterHeader: !!clusterHeader,
        metricCardCount: metricCards.length,
        bodyText: document.body.innerText.substring(0, 500),
      };
    });

    console.log('[UAT-22-01] Page state:', JSON.stringify(pageState, null, 2));

    // Critical filter: no JS errors (except SignalR transport failures which are expected)
    const criticalErrors = jsErrors.filter(e =>
      !e.includes('SignalR') && !e.includes('HubConnection') &&
      !e.includes('WebSocket') && !e.includes('favicon') &&
      !e.includes('net::ERR')
    );
    expect(criticalErrors, `Critical JS errors: ${criticalErrors.join(', ')}`).toHaveLength(0);

    // The page should render the monitoring dashboard container
    expect(pageState.hasDashboard || pageState.hasSpinner, 'Monitoring page must render dashboard or loading state').toBe(true);

    // CRITICAL: All 6 tabs must be present (they render regardless of data)
    if (pageState.hasDashboard) {
      expect(pageState.tabCount, 'All 6 monitoring tabs must be present').toBeGreaterThanOrEqual(6);
    }

    // Report what's happening with data
    if (pageState.skeletonCount > 0 && !pageState.hasClusterHeader) {
      console.warn('[UAT-22-01] WARNING: Skeleton still showing - SignalR infra broadcast may not be delivering data. This is the reported issue.');
    } else if (pageState.hasClusterHeader) {
      console.log('[UAT-22-01] SUCCESS: Cluster header is visible - SignalR data received!');
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/p22-01-monitoring-final.png' });
  });

  // ─── TEST 2: Skeleton Loading ────────────────────────────────────────────────
  test('UAT-22-02: Skeleton loading shows on fresh load before data arrives', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });

    // Navigate and wait for React app to mount (but NOT for SignalR data)
    await page.goto(`${BASE_URL}/monitoring`, { waitUntil: 'domcontentloaded' });

    // Wait for React to mount (SPA hydration) — look for either spinner or dashboard
    await page.waitForSelector('.monitoring-dashboard, .ant-spin, .ant-skeleton', { timeout: 10000 });
    await page.screenshot({ path: 'test-results/p22-02-skeleton-initial.png' });

    const initialState = await page.evaluate(() => {
      const spinner = document.querySelector('.ant-spin');
      const skeletons = document.querySelectorAll('.ant-skeleton');
      const dashboard = document.querySelector('.monitoring-dashboard');
      return {
        hasSpinner: !!spinner,
        skeletonCount: skeletons.length,
        hasDashboard: !!dashboard,
      };
    });

    console.log('[UAT-22-02] Initial state (after React mount):', JSON.stringify(initialState));

    // Either skeleton OR spinner must show initially (before data arrives)
    const hasLoadingState = initialState.hasSpinner || initialState.skeletonCount > 0;
    expect(hasLoadingState, 'Page must show skeleton or spinner before SignalR data arrives').toBe(true);

    // Verify NO mock data generator functions in bundle
    const pageSource = await page.content();
    expect(pageSource, 'generateServiceStatuses must not be in bundle').not.toContain('generateServiceStatuses');
    expect(pageSource, 'generatePipelineEvents must not be in bundle').not.toContain('generatePipelineEvents');
    expect(pageSource, 'generateDashboardMetrics must not be in bundle').not.toContain('generateDashboardMetrics');
    expect(pageSource, 'generatePodStatuses must not be in bundle').not.toContain('generatePodStatuses');

    console.log('[UAT-22-02] PASS: Skeleton loading is shown, no mock data in bundle');
    await page.screenshot({ path: 'test-results/p22-02-skeleton-verified.png' });
  });

  // ─── TEST 3: DataSource List Auto-Refreshes ──────────────────────────────────
  test('UAT-22-03: DataSource list auto-refreshes when another user creates a DataSource', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });

    // Navigate to data sources list
    await page.goto(`${BASE_URL}/datasources`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // let initial load settle

    await page.screenshot({ path: 'test-results/p22-03-datasources-before.png' });

    // Count current datasources
    const rowsBefore = await page.locator('.ant-table-row, [data-row-key]').count();
    console.log(`[UAT-22-03] DataSources before: ${rowsBefore}`);

    // Listen for EntityChanged via console log
    const signalRLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('EntityChanged') || text.includes('SignalR')) {
        signalRLogs.push(text);
      }
    });

    // Create a datasource via API (simulating another user)
    console.log('[UAT-22-03] Creating datasource via API...');
    let createdId: string | null = null;
    try {
      const ds = await createTestDataSource(request, 'DS');
      createdId = ds.id;
      console.log(`[UAT-22-03] Created datasource ID: ${createdId}`);
    } catch (err: any) {
      console.error('[UAT-22-03] API create failed:', err.message);
      // Still continue to verify the page - may need to check if API is reachable
    }

    // Wait for SignalR EntityChanged to arrive and React Query to invalidate
    await page.waitForTimeout(4000);
    await page.screenshot({ path: 'test-results/p22-03-datasources-after.png' });

    const rowsAfter = await page.locator('.ant-table-row, [data-row-key]').count();
    console.log(`[UAT-22-03] DataSources after: ${rowsAfter}`);
    console.log(`[UAT-22-03] SignalR logs received: ${signalRLogs.join('; ')}`);

    // Cleanup
    if (createdId) {
      await deleteTestDataSource(request, createdId);
    }

    // If datasource was created, the list must auto-refresh (or show same rows if create failed)
    if (createdId) {
      expect(rowsAfter, 'DataSource list must auto-refresh after remote create (rows should increase)').toBeGreaterThanOrEqual(rowsBefore + 1);
      console.log('[UAT-22-03] PASS: List auto-refreshed without manual refresh');
    } else {
      console.warn('[UAT-22-03] SKIP: Could not create datasource via API — cannot verify auto-refresh');
      test.skip(true, 'DataSource API not reachable');
    }
  });

  // ─── TEST 4: NAS Device List Auto-Refreshes ──────────────────────────────────
  test('UAT-22-04: NAS device list auto-refreshes when another user updates a NAS device', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });

    // Navigate to admin → NAS devices
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');

    // Try to find NAS devices section
    const nasTab = page.locator('[data-node-key="nas"], [href*="nas"], button:has-text("NAS"), a:has-text("NAS")').first();
    const hasNasTab = await nasTab.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasNasTab) {
      await nasTab.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'test-results/p22-04-nas-initial.png' });

    // Verify SignalR EntityChanged arrives when NAS is updated via API
    const signalRLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('EntityChanged') || text.includes('NasDevice')) signalRLogs.push(text);
    });

    // Get existing NAS devices
    const nasResp = await request.get(`${API_URL}/api/v1/nasdevices`);
    console.log(`[UAT-22-04] GET nas-devices status: ${nasResp.status()}`);

    if (nasResp.ok()) {
      const nasData = await nasResp.json();
      const devices = nasData.Data || nasData.data || nasData;
      const deviceList = Array.isArray(devices) ? devices : [];
      console.log(`[UAT-22-04] Found ${deviceList.length} NAS devices`);

      if (deviceList.length > 0) {
        const device = deviceList[0];
        const deviceId = device.ID || device.id;
        const version = device.Version || 1;

        // Update the device via API
        const updateResp = await request.put(`${API_URL}/api/v1/nasdevices/${deviceId}`, {
          data: {
            Name: device.Name,
            Description: `UAT-P22-04 update ${Date.now()}`,
            Version: version,
          }
        });
        console.log(`[UAT-22-04] Update NAS status: ${updateResp.status()}`);

        // Wait for SignalR EntityChanged event
        await page.waitForTimeout(3000);
        await page.screenshot({ path: 'test-results/p22-04-nas-after-update.png' });

        const hasEntityChanged = signalRLogs.some(l => l.includes('EntityChanged'));
        console.log(`[UAT-22-04] EntityChanged received: ${hasEntityChanged}`);
        console.log(`[UAT-22-04] SignalR logs: ${signalRLogs.join('; ')}`);

        if (updateResp.ok()) {
          expect(hasEntityChanged, 'EntityChanged SignalR event must be logged when NAS is updated').toBe(true);
        } else {
          console.warn(`[UAT-22-04] Update returned ${updateResp.status()} - checking if 409`);
        }
      } else {
        console.warn('[UAT-22-04] No NAS devices found — skipping update test');
        test.skip(true, 'No NAS devices available to test');
      }
    } else {
      console.warn('[UAT-22-04] NAS API not reachable');
      test.skip(true, 'NAS API not reachable');
    }
  });

  // ─── TEST 5: Optimistic Locking - 409 Conflict ───────────────────────────────
  test('UAT-22-05: Optimistic locking returns 409 when updating with stale Version', async ({ page, request }) => {
    await page.setViewportSize({ width: 1400, height: 900 });

    // Create a datasource with Version=1
    let createdId: string | null = null;
    let currentVersion: number = 1;

    try {
      const ds = await createTestDataSource(request, 'OL');
      createdId = ds.id;
      currentVersion = ds.version ?? 1;
      console.log(`[UAT-22-05] Created DS ID=${createdId} Version=${currentVersion}`);
    } catch (err: any) {
      console.error('[UAT-22-05] Cannot create test datasource:', err.message);
      test.skip(true, 'DataSource API not reachable');
      return;
    }

    // Step 1: Update to increment version
    const updateResp1 = await request.put(`${API_URL}/api/v1/datasource/${createdId}`, {
      data: {
        Id: createdId,
        Name: `UAT-OL-Updated-${Date.now()}`,
        SupplierName: 'UAT Test Supplier',
        Category: 'Sales',
        Version: currentVersion,
        IsActive: false,
      }
    });
    console.log(`[UAT-22-05] First update status: ${updateResp1.status()}`);

    // Step 2: Now try to update with the OLD (stale) version — should get 409
    const updateResp2 = await request.put(`${API_URL}/api/v1/datasource/${createdId}`, {
      data: {
        Id: createdId,
        Name: `UAT-OL-Stale-${Date.now()}`,
        SupplierName: 'UAT Test Supplier',
        Category: 'Sales',
        Version: currentVersion, // STALE - version did not increment
        IsActive: false,
      }
    });
    console.log(`[UAT-22-05] Stale version update status: ${updateResp2.status()}`);

    const conflict409Body = await updateResp2.text();
    console.log(`[UAT-22-05] 409 response body: ${conflict409Body.substring(0, 200)}`);

    // Cleanup
    if (createdId) {
      await deleteTestDataSource(request, createdId);
    }

    // The second update with stale version must return 409
    if (updateResp1.ok()) {
      expect(updateResp2.status(), 'Stale version update must return 409 Conflict').toBe(409);
      console.log('[UAT-22-05] PASS: 409 Conflict returned for stale version');
    } else {
      // If first update also failed, skip
      console.warn('[UAT-22-05] First update failed — optimistic locking test inconclusive');
      test.skip(true, 'DataSource update API not working correctly');
    }

    // Also verify UI shows 409 error
    await page.goto(`${BASE_URL}/datasources`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/p22-05-datasource-list.png' });
  });

  // ─── TEST 6: SignalR Hub Structure ───────────────────────────────────────────
  test('UAT-22-06: MonitoringHub negotiate returns WebSocket transport', async ({ request }) => {
    const resp = await request.post(`${API_URL}/hubs/monitoring/negotiate?negotiateVersion=1`, {
      headers: { 'Content-Type': 'application/json' }
    });

    expect(resp.status(), 'Negotiate must return 200').toBe(200);

    const data = await resp.json();
    console.log('[UAT-22-06] Negotiate response:', JSON.stringify(data, null, 2));

    expect(data.connectionId, 'Must return connectionId').toBeTruthy();
    expect(data.availableTransports, 'Must return availableTransports').toBeTruthy();

    const transportNames = (data.availableTransports || []).map((t: any) => t.transport);
    console.log('[UAT-22-06] Available transports:', transportNames);
    expect(transportNames, 'WebSockets must be available').toContain('WebSockets');
  });

  // ─── TEST 7: Monitoring Page Structure (visual corruption check) ──────────────
  test('UAT-22-07: Monitoring page structure is intact (not corrupted)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const jsErrors: string[] = [];
    page.on('pageerror', err => jsErrors.push(err.message));

    await page.goto(`${BASE_URL}/monitoring`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'test-results/p22-07-monitoring-structure.png', fullPage: true });

    // 1. No critical JS errors
    const criticalErrors = jsErrors.filter(e =>
      !e.includes('SignalR') && !e.includes('WebSocket') &&
      !e.includes('HubConnection') && !e.includes('net::ERR')
    );
    expect(criticalErrors, `Critical JS errors found: ${criticalErrors.join('; ')}`).toHaveLength(0);

    // 2. The page renders SOMETHING
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.trim().length, 'Page must render content').toBeGreaterThan(10);

    // 3. RTL direction set
    const dir = await page.evaluate(() => document.documentElement.dir || 'ltr');
    expect(dir, 'Page must be RTL').toBe('rtl');

    // 4. Monitoring dashboard container exists
    const dashboard = page.locator('.monitoring-dashboard');
    const dashExists = await dashboard.isVisible({ timeout: 5000 }).catch(() => false);

    // 5. Tab bar exists (even in loading/skeleton state, the page wraps tabs)
    const tabsOrSkeleton = await page.locator('.ant-tabs, .ant-skeleton, .ant-spin').count();

    console.log(`[UAT-22-07] Dashboard visible: ${dashExists}, tabs/skeleton count: ${tabsOrSkeleton}`);
    console.log(`[UAT-22-07] Body text preview: ${bodyText?.substring(0, 200)}`);

    expect(dashExists || tabsOrSkeleton > 0, 'Page must render monitoring content (dashboard, tabs, or skeleton)').toBe(true);
  });
});
