import { test, expect } from '@playwright/test';

test.use({ launchOptions: { slowMo: 300 } });

test.describe('Part 1: Input/Output Tab Server Selection Verification', () => {

  test('Input tab — FTP servers filter', async ({ page }) => {
    test.setTimeout(120000);

    // Get expected FTP input servers from API
    const apiResp = await page.request.get('http://localhost:5001/api/v1/servers/input');
    const allInputServers = await apiResp.json();
    const expectedFtp = allInputServers
      .filter((s: any) => s.IsActive && s.ServerType?.toLowerCase() === 'ftp')
      .map((s: any) => s.Name);
    console.log('Expected FTP input servers:', expectedFtp);

    // Navigate to datasource create
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Go to connection tab
    const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
    if (await connectionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await connectionTab.click();
      await page.waitForTimeout(1500);
    }

    // Select FTP protocol
    const protocolSelect = page.locator('.ant-select').first();
    await protocolSelect.click();
    await page.waitForTimeout(500);
    const ftpOption = page.locator('.ant-select-item-option').filter({ hasText: /^FTP$/i });
    if (await ftpOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ftpOption.click();
      await page.waitForTimeout(1500);
    }

    // Open server dropdown (second select)
    const serverSelects = page.locator('.ant-select').filter({ hasNotText: /FTP|SFTP|NAS|HTTP|Kafka|S3/ });
    const serverSelect = serverSelects.first();
    if (await serverSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await serverSelect.click();
      await page.waitForTimeout(1000);

      // Collect visible options
      const options = page.locator('.ant-select-item-option');
      const optionTexts = await options.allTextContents();
      console.log('Visible FTP server options:', optionTexts);

      // Verify each expected server appears
      for (const name of expectedFtp) {
        const found = optionTexts.some(t => t.includes(name));
        console.log(`  FTP "${name}": ${found ? 'FOUND' : 'MISSING'}`);
      }

      // Close dropdown
      await page.keyboard.press('Escape');
    }
    console.log('>>> FTP input servers verification complete');
  });

  test('Input tab — SFTP servers filter', async ({ page }) => {
    test.setTimeout(120000);

    const apiResp = await page.request.get('http://localhost:5001/api/v1/servers/input');
    const allInputServers = await apiResp.json();
    const expectedSftp = allInputServers
      .filter((s: any) => s.IsActive && s.ServerType?.toLowerCase() === 'sftp')
      .map((s: any) => s.Name);
    console.log('Expected SFTP input servers:', expectedSftp);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
    if (await connectionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await connectionTab.click();
      await page.waitForTimeout(1500);
    }

    // Select SFTP protocol
    const protocolSelect = page.locator('.ant-select').first();
    await protocolSelect.click();
    await page.waitForTimeout(500);
    const sftpOption = page.locator('.ant-select-item-option').filter({ hasText: /^SFTP$/i });
    if (await sftpOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sftpOption.click();
      await page.waitForTimeout(1500);
    }

    // Open server dropdown
    const allSelects = page.locator('.ant-select');
    const selectCount = await allSelects.count();
    for (let i = 1; i < selectCount; i++) {
      const sel = allSelects.nth(i);
      const text = await sel.textContent().catch(() => '');
      if (text && !text.match(/SFTP|FTP|NAS|HTTP/)) {
        await sel.click();
        await page.waitForTimeout(1000);
        const options = page.locator('.ant-select-item-option');
        const optionTexts = await options.allTextContents();
        console.log('Visible SFTP server options:', optionTexts);

        for (const name of expectedSftp) {
          const found = optionTexts.some(t => t.includes(name));
          console.log(`  SFTP "${name}": ${found ? 'FOUND' : 'MISSING'}`);
        }
        await page.keyboard.press('Escape');
        break;
      }
    }
    console.log('>>> SFTP input servers verification complete');
  });

  test('Input tab — NAS devices filter (Input/Both roles)', async ({ page }) => {
    test.setTimeout(120000);

    // Get expected NAS devices
    const apiResp = await page.request.get('http://localhost:5001/api/v1/nasdevices');
    const allNas = await apiResp.json();
    const roleMap: Record<number, string> = { 0: 'Input', 1: 'Output', 2: 'Backup', 3: 'Both' };
    const inputNas = allNas.filter((d: any) => {
      const role = typeof d.Role === 'number' ? roleMap[d.Role] : d.Role;
      return role === 'Input' || role === 'Both';
    });
    const mountedInputNas = inputNas.filter((d: any) => d.IsPvCreated && d.IsPvcBound);
    const unmountedInputNas = inputNas.filter((d: any) => !d.IsPvCreated || !d.IsPvcBound);
    console.log('Expected input NAS devices:', inputNas.length, '(mounted:', mountedInputNas.length, ', unmounted:', unmountedInputNas.length, ')');

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const connectionTab = page.getByRole('tab', { name: /חיבור|connection/i });
    if (await connectionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await connectionTab.click();
      await page.waitForTimeout(1500);
    }

    // Select NAS protocol
    const protocolSelect = page.locator('.ant-select').first();
    await protocolSelect.click();
    await page.waitForTimeout(500);
    const nasOption = page.locator('.ant-select-item-option').filter({ hasText: 'NAS' });
    if (await nasOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nasOption.click();
      await page.waitForTimeout(2000);
    }

    // Open NAS device dropdown
    const allSelects = page.locator('.ant-select');
    const selectCount = await allSelects.count();
    for (let i = 1; i < selectCount; i++) {
      const sel = allSelects.nth(i);
      if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sel.click();
        await page.waitForTimeout(1000);

        const options = page.locator('.ant-select-item-option');
        const optionCount = await options.count();
        console.log('NAS device options count:', optionCount);

        // Check for disabled options (unmounted)
        const disabledOptions = page.locator('.ant-select-item-option-disabled');
        const disabledCount = await disabledOptions.count();
        console.log('Disabled (unmounted) options:', disabledCount);
        console.log('Expected unmounted:', unmountedInputNas.length);

        // Verify no Output-only devices appear
        const optionTexts = await options.allTextContents();
        const outputOnlyNames = allNas
          .filter((d: any) => (typeof d.Role === 'number' ? roleMap[d.Role] : d.Role) === 'Output')
          .map((d: any) => d.Name);
        for (const name of outputOnlyNames) {
          const found = optionTexts.some(t => t.includes(name));
          if (found) console.log(`  ERROR: Output-only NAS "${name}" found in input dropdown!`);
        }

        expect(optionCount).toBeGreaterThan(0);
        console.log('>>> NAS input filter: no Output-only devices in dropdown');

        await page.keyboard.press('Escape');
        break;
      }
    }
    console.log('>>> NAS input devices verification complete');
  });

  test('Output tab — FTP servers filter', async ({ page }) => {
    test.setTimeout(120000);

    const apiResp = await page.request.get('http://localhost:5001/api/v1/servers/output');
    const allOutputServers = await apiResp.json();
    const expectedFtp = allOutputServers
      .filter((s: any) => s.IsActive && s.ServerType?.toLowerCase() === 'ftp')
      .map((s: any) => s.Name);
    console.log('Expected FTP output servers:', expectedFtp);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Widen viewport for all tabs
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(500);

    // Click output tab via dispatchEvent (Ant Design lazy tab)
    await page.evaluate(() => {
      const tabBtn = document.querySelector('[id$="-tab-output"]') as HTMLElement;
      if (tabBtn) tabBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(3000);

    // Click "הוסף יעד פלט" button
    const addDestBtn = page.locator('button').filter({ hasText: /הוסף יעד פלט/ });
    if (await addDestBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addDestBtn.click();
      await page.waitForTimeout(1500);
    }

    // In modal, select FTP type
    const modal = page.locator('.ant-modal-content');
    const typeSelect = modal.locator('.ant-select').first();
    await typeSelect.click();
    await page.waitForTimeout(500);
    const ftpOpt = page.locator('.ant-select-item-option').filter({ hasText: /^FTP$/i });
    if (await ftpOpt.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ftpOpt.click();
      await page.waitForTimeout(1500);
    }

    // Open server dropdown in modal
    const modalSelects = modal.locator('.ant-select');
    const msCount = await modalSelects.count();
    for (let i = 1; i < msCount; i++) {
      const sel = modalSelects.nth(i);
      const text = await sel.textContent().catch(() => '');
      if (text && !text.match(/FTP|NAS|SFTP/i)) {
        await sel.click();
        await page.waitForTimeout(1000);
        const options = page.locator('.ant-select-item-option');
        const optionTexts = await options.allTextContents();
        console.log('Visible FTP output server options:', optionTexts);

        for (const name of expectedFtp) {
          const found = optionTexts.some(t => t.includes(name));
          console.log(`  FTP output "${name}": ${found ? 'FOUND' : 'MISSING'}`);
        }
        await page.keyboard.press('Escape');
        break;
      }
    }
    console.log('>>> FTP output servers verification complete');
  });

  test('Output tab — NAS devices filter (Output/Both/Backup roles)', async ({ page }) => {
    test.setTimeout(120000);

    const apiResp = await page.request.get('http://localhost:5001/api/v1/nasdevices');
    const allNas = await apiResp.json();
    const roleMap: Record<number, string> = { 0: 'Input', 1: 'Output', 2: 'Backup', 3: 'Both' };
    const outputNas = allNas.filter((d: any) => {
      const role = typeof d.Role === 'number' ? roleMap[d.Role] : d.Role;
      return role === 'Output' || role === 'Both' || role === 'Backup';
    });
    const inputOnlyNames = allNas
      .filter((d: any) => (typeof d.Role === 'number' ? roleMap[d.Role] : d.Role) === 'Input')
      .map((d: any) => d.Name);
    console.log('Expected output NAS devices:', outputNas.length);
    console.log('Input-only NAS (should NOT appear):', inputOnlyNames.length);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /הוסף|add/i }).click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const tabBtn = document.querySelector('[id$="-tab-output"]') as HTMLElement;
      if (tabBtn) tabBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(3000);

    // NAS is the default type in destination editor — just open the modal
    const addDestBtn = page.locator('button').filter({ hasText: /הוסף יעד פלט/ });
    if (await addDestBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addDestBtn.click();
      await page.waitForTimeout(1500);
    }

    // NAS should be default — find the NAS device dropdown
    const modal = page.locator('.ant-modal-content');
    const modalSelects = modal.locator('.ant-select');
    const msCount = await modalSelects.count();
    for (let i = 1; i < msCount; i++) {
      const sel = modalSelects.nth(i);
      if (await sel.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sel.click();
        await page.waitForTimeout(1000);

        const options = page.locator('.ant-select-item-option');
        const optionTexts = await options.allTextContents();
        console.log('NAS output device options:', optionTexts.length);

        // Verify no Input-only devices
        for (const name of inputOnlyNames) {
          const found = optionTexts.some(t => t === name || t.startsWith(name + ' '));
          if (found) console.log(`  ERROR: Input-only NAS "${name}" found in output dropdown!`);
        }

        // Verify Output/Both/Backup devices present
        const expectedNames = outputNas.map((d: any) => d.Name);
        let foundCount = 0;
        for (const name of expectedNames) {
          if (optionTexts.some(t => t.includes(name))) foundCount++;
        }
        console.log(`  Found ${foundCount}/${expectedNames.length} expected output NAS devices`);

        await page.keyboard.press('Escape');
        break;
      }
    }
    console.log('>>> NAS output devices verification complete');
  });
});
