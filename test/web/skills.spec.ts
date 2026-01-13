import { test, expect } from './fixtures';

test.describe('Web UI - Skills', () => {
  test('skills page loads from sidebar', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Skills' }).click();
    await expect(page.getByRole('heading', { name: 'Skills' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Add Skill' })).toBeVisible();
  });
});
