import { existsSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { SIPHON_DIR } from "../config/paths";
import type { CleanOptions } from "../types";

// Remove old session files from ~/.siphon.
export function cleanSessions(options: CleanOptions): void {
  if (!existsSync(SIPHON_DIR)) {
    console.log("Nothing to clean.");
    return;
  }

  const files = readdirSync(SIPHON_DIR);
  const maxAge = options.all ? 0 : (options.days || 7) * 24 * 60 * 60 * 1000;
  const now = Date.now();

  let removed = 0;

  for (const file of files) {
    const filePath = join(SIPHON_DIR, file);
    const age = now - statSync(filePath).mtimeMs;

    if (options.all || age > maxAge) {
      unlinkSync(filePath);
      removed++;
    }
  }

  console.log(`Removed ${removed} file(s).`);
}
