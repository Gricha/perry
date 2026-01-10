#!/usr/bin/env node

import { startAgent } from './run';

process.on('unhandledRejection', (reason, promise) => {
  console.error('[agent] Unhandled promise rejection:', reason);
  console.error('[agent] Promise:', promise);
});

process.on('uncaughtException', (err) => {
  console.error('[agent] Uncaught exception:', err);
});

startAgent().catch((err) => {
  console.error('[agent] Fatal error:', err);
  process.exit(1);
});
