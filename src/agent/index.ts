#!/usr/bin/env node

import { startAgent } from './run';

startAgent().catch((err) => {
  console.error('[agent] Fatal error:', err);
  process.exit(1);
});
