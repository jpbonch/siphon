import type { Agent } from "./types";
import { claudeAgent } from "./definitions/claude";
import { cursorAgent } from "./definitions/cursor";

// Single place to edit the supported agent catalog.
export const agents: Record<string, Agent> = {
  [claudeAgent.id]: claudeAgent,
  [cursorAgent.id]: cursorAgent,
};
