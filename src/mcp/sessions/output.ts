import { execSync } from "child_process";

// Read the tail of a log file via `tail` for speed on large files.
export function getLastNLines(logPath: string, lineCount: number): string {
  try {
    return execSync(`tail -n ${lineCount} "${logPath}"`, { encoding: "utf-8" });
  } catch {
    return "";
  }
}
