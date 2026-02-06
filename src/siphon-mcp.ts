#!/usr/bin/env bun
import { runMcpServer } from "./mcp";

// Keep top-level entrypoint tiny; tools and utilities live in `src/mcp/*`.
runMcpServer().catch((error: Error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
