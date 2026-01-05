#!/usr/bin/env bun
import { runCli } from "./cli";
import { CommandError } from "./lib/process";

await runCli().catch((error) => {
  if (error instanceof CommandError) {
    console.error(error.message);
    if (error.stderr.trim()) {
      console.error(error.stderr.trim());
    }
  } else if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
