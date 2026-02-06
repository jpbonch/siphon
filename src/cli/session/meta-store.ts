import { readFileSync, writeFileSync } from "fs";
import type { SessionMeta } from "../types";

// Persist session metadata in a predictable JSON structure.
export function writeMeta(metaPath: string, meta: SessionMeta): void {
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

// Read metadata safely; return null for missing/invalid files.
export function readMeta(metaPath: string): SessionMeta | null {
  try {
    const content = readFileSync(metaPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Check process liveness with signal 0.
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
