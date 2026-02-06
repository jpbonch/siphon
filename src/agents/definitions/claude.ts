import { join } from "path";
import { homedir } from "os";
import type { Agent } from "../types";

// Claude Code-specific integration settings.
export const claudeAgent: Agent = {
  id: "claude",
  displayName: "Claude Code",
  projectMarkers: [".claude", "CLAUDE.md"],
  envVariable: "CLAUDE_CODE",
  globalConfigPath: join(homedir(), ".claude.json"),
  instructionsFile: "CLAUDE.md",
};
