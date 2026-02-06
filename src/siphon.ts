#!/usr/bin/env bun
import { runCli } from "./cli";

// Keep top-level entrypoint tiny; all behavior lives in `src/cli/*` modules.
runCli(process.argv.slice(2)).catch((error: Error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
