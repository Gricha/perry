import { test, expect } from './fixtures';

test.describe('Web UI - MCP', () => {
  test('mcp page loads from sidebar', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'MCP' }).click();
    await expect(page.getByRole('heading', { name: 'MCP Servers' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Add MCP Server' })).toBeVisible();
  });
});
