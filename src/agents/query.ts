import type { Agent } from "./types";
import { agents } from "./registry";

// Lookup helpers used by the CLI init flow.
export function getAgentById(id: string): Agent | undefined {
  return agents[id];
}

export function getAllAgentIds(): string[] {
  return Object.keys(agents);
}
