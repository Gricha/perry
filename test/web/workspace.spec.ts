import { test, expect } from './fixtures';
import { generateTestWorkspaceName } from '../helpers/agent';

test.describe('Web UI', () => {
  test('loads dashboard page', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Workspaces');
  });

  test('shows empty workspace list', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
    await expect(page.getByText('No workspaces yet')).toBeVisible({ timeout: 15000 });
  });

  test('can navigate to settings', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings`);
    await expect(page.locator('h1')).toContainText('Settings', { timeout: 15000 });
  });
});

test.describe('Web UI - Workspace Operations', () => {
  test('shows created workspace in list', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
      await expect(page.getByText(workspaceName)).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('can open workspace detail page', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
      await expect(page.locator('h1')).toContainText(workspaceName, { timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('shows workspace status indicators', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces`);
      await expect(page.getByText(workspaceName)).toBeVisible({ timeout: 30000 });
      await expect(page.getByText('running')).toBeVisible();
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('can stop workspace from detail page', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
      await expect(page.locator('h1')).toContainText(workspaceName, { timeout: 30000 });

      const stopButton = page.getByRole('button', { name: /stop/i });
      await stopButton.click();

      await expect(page.getByText('stopped')).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);
});

test.describe('Web UI - Settings Pages', () => {
  test('environment settings page loads', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/environment`);
    await expect(page.locator('h1')).toContainText('Environment', { timeout: 15000 });
  });

  test('agents settings page loads', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/agents`);
    await expect(page.getByText('Coding Agents')).toBeVisible({ timeout: 15000 });
  });

  test('files settings page loads', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/files`);
    await expect(page.getByText('Credential Files')).toBeVisible({ timeout: 15000 });
  });

  test('scripts settings page loads', async ({ agent, page }) => {
    await page.goto(`http://127.0.0.1:${agent.port}/settings/scripts`);
    await expect(page.getByText('Scripts')).toBeVisible({ timeout: 15000 });
  });
});

test.describe('Web UI - Terminal', () => {
  test('can open terminal and type commands', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}`);
      await expect(page.locator('h1')).toContainText(workspaceName, { timeout: 30000 });

      const terminalButton = page.getByRole('button', { name: /terminal/i });
      await terminalButton.click();

      const terminalScreen = page.locator('[data-testid="terminal-screen"]');
      await expect(terminalScreen).toBeVisible({ timeout: 15000 });

      await page.waitForTimeout(2000);

      await terminalScreen.click();
      await page.keyboard.type('echo hello-from-test', { delay: 50 });
      await page.keyboard.press('Enter');

      await page.waitForTimeout(2000);

      const terminalText = await terminalScreen.textContent();
      expect(terminalText).toContain('hello-from-test');
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('can navigate directly to terminal via URL param', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}?terminal=true`);

      const terminalScreen = page.locator('[data-testid="terminal-screen"]');
      await expect(terminalScreen).toBeVisible({ timeout: 15000 });

      const terminalContainer = page.locator('[data-testid="terminal-container"]');
      await expect(terminalContainer).toBeVisible();

      const backButton = page.getByRole('button', { name: /back/i });
      await expect(backButton).toBeVisible();

      await backButton.click();

      await expect(page.locator('h1')).toContainText(workspaceName, { timeout: 10000 });
      expect(page.url()).not.toContain('terminal=true');
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);
});

test.describe('Web UI - Sessions', () => {
  test('sessions page shows workspace not running message when stopped', async ({
    agent,
    page,
  }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });
    await agent.api.stopWorkspace(workspaceName);

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}/sessions`);
      await expect(page.getByText('Workspace is not running')).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('sessions page loads for running workspace', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}/sessions`);
      await expect(page.locator('h1')).toContainText('Sessions', { timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('sessions page has agent filter dropdown', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}/sessions`);
      await expect(page.getByRole('button', { name: /all agents/i })).toBeVisible({
        timeout: 30000,
      });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);

  test('sessions page has new chat dropdown', async ({ agent, page }) => {
    const workspaceName = generateTestWorkspaceName();
    await agent.api.createWorkspace({ name: workspaceName });

    try {
      await page.goto(`http://127.0.0.1:${agent.port}/workspaces/${workspaceName}/sessions`);
      await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible({ timeout: 30000 });
    } finally {
      await agent.api.deleteWorkspace(workspaceName);
    }
  }, 120000);
});
