import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: {
      forks: {
        // Allow multiple forks for parallel test execution
        // Each fork gets its own agent on a random port, so no conflicts
        singleFork: false,
        maxForks: process.env.CI ? 3 : undefined,
      },
    },
    // Enable file parallelism - tests use random ports so no conflicts
    fileParallelism: true,
    globalSetup: './test/setup/global.js',
    exclude: ['**/node_modules/**', '**/test/web/**', '**/test/tui/**', '**/web/e2e/**'],
  },
});
