import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Agent } from "./types";

// Add Siphon guidance to an agent instructions file if not already present.
export function appendInstructions(agent: Agent, cwd: string, content: string): boolean {
  const filePath = join(cwd, agent.instructionsFile);
  let existingContent = "";

  if (existsSync(filePath)) {
    existingContent = readFileSync(filePath, "utf-8");

    if (existingContent.toLowerCase().includes("siphon")) {
      return false;
    }
  }

  writeFileSync(filePath, existingContent + content);
  return true;
}
