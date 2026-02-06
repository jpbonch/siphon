import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { Agent } from "./types";

interface McpConfigShape {
  mcpServers?: Record<string, unknown>;
}

// Shared MCP entry for Siphon. Keep this in one place so users can tweak it.
const SIPHON_MCP_ENTRY = {
  command: "siphon-mcp",
  args: [],
};

// Writes MCP config for a specific agent; returns false if already configured.
export function writeMcpConfig(agent: Agent): boolean {
  const configPath = agent.globalConfigPath;
  const configDir = dirname(configPath);

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  let config: McpConfigShape = {};

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
      config.mcpServers = config.mcpServers ?? {};

      if (config.mcpServers["siphon"]) {
        return false;
      }
    } catch {
      // If JSON is malformed, rebuild with just mcpServers.
      config = { mcpServers: {} };
    }
  } else {
    config = { mcpServers: {} };
  }

  config.mcpServers!["siphon"] = SIPHON_MCP_ENTRY;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  return true;
}
