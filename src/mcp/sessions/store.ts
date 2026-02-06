import { existsSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { SIPHON_DIR } from "../config/paths";
import type { FullSessionMeta, SessionRecord } from "../types";

// Check if process still exists to identify stale running metadata.
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Read session metadata JSON.
export function readMeta(metaPath: string): FullSessionMeta | null {
  try {
    const content = readFileSync(metaPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Persist metadata updates (e.g., stale process reconciliation).
export function writeMeta(metaPath: string, meta: FullSessionMeta): void {
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

// Enumerate all known siphon sessions from ~/.siphon.
export function getAllSessions(): SessionRecord[] {
  if (!existsSync(SIPHON_DIR)) {
    return [];
  }

  const files = readdirSync(SIPHON_DIR).filter((file) => file.endsWith(".meta.json"));
  const sessions: SessionRecord[] = [];

  for (const file of files) {
    const metaPath = join(SIPHON_DIR, file);
    const meta = readMeta(metaPath);
    if (!meta) continue;

    const logPath = metaPath.replace(".meta.json", ".log");

    // Auto-heal stale "running" sessions if the PID no longer exists.
    if (meta.status === "running" && !isPidAlive(meta.pid)) {
      meta.status = "exited";
      meta.exitCode = null;
      writeMeta(metaPath, meta);
    }

    sessions.push({ meta, metaPath, logPath });
  }

  return sessions;
}
