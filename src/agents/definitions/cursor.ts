import { join } from "path";
import { homedir } from "os";
import type { Agent } from "../types";

// Cursor-specific integration settings.
export const cursorAgent: Agent = {
  id: "cursor",
  displayName: "Cursor",
  projectMarkers: [".cursor", ".cursorrules"],
  envVariable: "CURSOR_SESSION_ID",
  globalConfigPath: join(homedir(), ".cursor", "mcp.json"),
  instructionsFile: ".cursorrules",
};
