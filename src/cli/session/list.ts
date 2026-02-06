import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { SIPHON_DIR } from "../config/paths";
import { readMeta, writeMeta, isPidAlive } from "./meta-store";
import { formatTimeAgo } from "../utils/time";

interface SessionListRow {
  session: string;
  status: string;
  port: string;
  pid: string;
  started: string;
  errors: string;
}

// Render a compact table of captured sessions.
export function listSessions(): void {
  if (!existsSync(SIPHON_DIR)) {
    console.log("No siphon sessions found.");
    return;
  }

  const files = readdirSync(SIPHON_DIR).filter((file) => file.endsWith(".meta.json"));
  if (files.length === 0) {
    console.log("No siphon sessions found.");
    return;
  }

  const sessions: SessionListRow[] = [];

  for (const file of files) {
    const metaPath = join(SIPHON_DIR, file);
    const meta = readMeta(metaPath);
    if (!meta) continue;

    let status = meta.status;
    let exitInfo = "";

    if (meta.status === "running" && !isPidAlive(meta.pid)) {
      status = "exited";
      exitInfo = "(stale)";
      meta.status = "exited";
      meta.exitCode = null;
      writeMeta(metaPath, meta);
    } else if (meta.status === "exited" && meta.exitCode !== null) {
      exitInfo = `(${meta.exitCode})`;
    }

    const ago = formatTimeAgo(new Date(meta.started));
    sessions.push({
      session: meta.session,
      status: `${status}${exitInfo}`,
      port: meta.port ? `port ${meta.port}` : "",
      pid: `pid ${meta.pid}`,
      started: `started ${ago}`,
      errors: `${meta.errorCount} error${meta.errorCount !== 1 ? "s" : ""}`,
    });
  }

  for (const session of sessions) {
    const parts = [session.session.padEnd(20), session.status.padEnd(12)];
    if (session.port) {
      parts.push(session.port.padEnd(12));
    }

    parts.push(session.pid.padEnd(12), session.started.padEnd(16), session.errors);
    console.log(parts.join("  "));
  }
}
