import { existsSync } from "fs";
import { join } from "path";
import { agents } from "./registry";

// Scan a project for known marker files/directories.
export function detectAgentsInProject(cwd: string): string[] {
  const detected: string[] = [];

  for (const [id, agent] of Object.entries(agents)) {
    for (const marker of agent.projectMarkers) {
      if (existsSync(join(cwd, marker))) {
        detected.push(id);
        break;
      }
    }
  }

  return detected;
}

// Determine active agent from environment hints when available.
// Checks the SIPHON_AGENT env var set in the MCP config first,
// then falls back to agent-specific env vars.
export function detectAgentFromEnvironment(): string | null {
  const siphonAgent = process.env.SIPHON_AGENT;
  if (siphonAgent && agents[siphonAgent]) {
    return siphonAgent;
  }

  for (const [id, agent] of Object.entries(agents)) {
    if (agent.envVariable && process.env[agent.envVariable]) {
      return id;
    }
  }

  return null;
}
