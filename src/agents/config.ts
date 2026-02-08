import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { Agent } from "./types";

interface McpConfigShape {
  mcpServers?: Record<string, unknown>;
}

// Resolve the absolute path to siphon-mcp.js next to the running CLI script.
// Works both for global npm installs (resolves through symlinks) and local dev builds.
function getSiphonMcpEntry(agent: Agent) {
  const scriptDir = dirname(realpathSync(process.argv[1]));
  return {
    command: "node",
    args: [join(scriptDir, "siphon-mcp.js")],
    env: { SIPHON_AGENT: agent.id },
  };
}

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

  config.mcpServers!["siphon"] = getSiphonMcpEntry(agent);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

  return true;
}
