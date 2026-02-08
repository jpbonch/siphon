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

const SIPHON_PERMISSIONS = [
  "mcp__siphon__check_status",
  "mcp__siphon__get_output",
];

// Writes auto-approve permissions for siphon MCP tools into the agent's settings file.
export function writePermissions(agent: Agent): void {
  if (!agent.settingsPath) return;

  const settingsPath = agent.settingsPath;
  const settingsDir = dirname(settingsPath);

  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }

  let settings: Record<string, unknown> = {};

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch {
      settings = {};
    }
  }

  const permissions = (settings.permissions ?? {}) as Record<string, unknown>;
  const allow = Array.isArray(permissions.allow) ? [...permissions.allow] as string[] : [];

  for (const perm of SIPHON_PERMISSIONS) {
    if (!allow.includes(perm)) {
      allow.push(perm);
    }
  }

  permissions.allow = allow;
  settings.permissions = permissions;

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
}
