import { test, expect } from '@playwright/test';

test.describe('Terminal Session Isolation', () => {
  test('terminal content should not persist when using sidebar navigation', async ({ page }) => {
    const MARKER_TEXT = 'SIDEBAR_NAV_MARKER_99999';

    await page.goto('/workspaces/test?tab=terminal');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'test-results/sidebar-1-initial.png', fullPage: true });

    const terminalContainer = page.locator('[data-testid="terminal-container"]');
    await expect(terminalContainer).toBeVisible();

    await terminalContainer.click();
    await page.waitForTimeout(500);

    for (let i = 0; i < 5; i++) {
      await page.keyboard.type(`echo "LINE_${i}_${MARKER_TEXT}"`, { delay: 30 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/sidebar-1-with-content.png', fullPage: true });

    const devLink = page.locator('a[href="/workspaces/dev"]').first();
    await devLink.click();
    await page.waitForTimeout(500);

    const terminalTab = page.locator('button:has-text("Terminal")');
    await terminalTab.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/sidebar-2-dev-terminal.png', fullPage: true });

    const testLink = page.locator('a[href="/workspaces/test"]').first();
    await testLink.click();
    await page.waitForTimeout(500);

    const terminalTab2 = page.locator('button:has-text("Terminal")');
    await terminalTab2.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/sidebar-3-back-to-test.png', fullPage: true });

    const websiteLink = page.locator('a[href="/workspaces/website"]').first();
    await websiteLink.click();
    await page.waitForTimeout(500);

    const terminalTab3 = page.locator('button:has-text("Terminal")');
    await terminalTab3.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/sidebar-4-website-terminal.png', fullPage: true });
  });

  test('rapid tab switching within same workspace', async ({ page }) => {
    await page.goto('/workspaces/test?tab=terminal');
    await page.waitForTimeout(3000);

    const terminalContainer = page.locator('[data-testid="terminal-container"]');
    await terminalContainer.click();
    await page.waitForTimeout(300);

    await page.keyboard.type('echo "RAPID_SWITCH_TEST"', { delay: 30 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'test-results/rapid-1-terminal-with-text.png', fullPage: true });

    const sessionsTab = page.locator('button:has-text("Sessions")');
    await sessionsTab.click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'test-results/rapid-2-sessions-tab.png', fullPage: true });

    const terminalTab = page.locator('button:has-text("Terminal")');
    await terminalTab.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/rapid-3-back-to-terminal.png', fullPage: true });

    for (let i = 0; i < 3; i++) {
      await sessionsTab.click();
      await page.waitForTimeout(200);
      await terminalTab.click();
      await page.waitForTimeout(200);
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/rapid-4-after-rapid-switch.png', fullPage: true });
  });
});
