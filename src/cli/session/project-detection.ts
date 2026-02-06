import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { PROJECT_INDICATOR_FILES, SOURCE_FILE_EXTENSIONS } from "../config/init";

// Determine whether cwd looks like a project root.
export function hasProjectFiles(cwd: string): boolean {
  for (const indicator of PROJECT_INDICATOR_FILES) {
    if (existsSync(join(cwd, indicator))) {
      return true;
    }
  }

  try {
    const files = readdirSync(cwd);
    for (const file of files) {
      if (SOURCE_FILE_EXTENSIONS.some((ext) => file.endsWith(ext))) {
        return true;
      }
    }
  } catch {
    // Ignore fs errors and return false.
  }

  return false;
}
