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
export function detectAgentFromEnvironment(): string | null {
  for (const [id, agent] of Object.entries(agents)) {
    if (agent.envVariable && process.env[agent.envVariable]) {
      return id;
    }
  }

  return null;
}
