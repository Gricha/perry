import { test as base } from '@playwright/test';
import { startTestAgent, type TestAgent } from '../helpers/agent';

type TestFixtures = {
  agent: TestAgent;
};

export const test = base.extend<TestFixtures>({
  agent: [
    async ({}, use) => {
      const agent = await startTestAgent();
      await use(agent);
      await agent.cleanup();
    },
    { scope: 'worker' },
  ],
});

export { expect } from '@playwright/test';
