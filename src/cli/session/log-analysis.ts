import { spawnSync } from "child_process";
import { statSync, writeFileSync } from "fs";
import { ERROR_PATTERNS, PORT_PATTERNS, SUCCESS_PATTERNS } from "../config/patterns";
import { MAX_LOG_SIZE_BYTES, TRUNCATE_TO_SIZE_BYTES } from "../config/logging";
import type { SessionMeta } from "../types";

// Detect port numbers from a single log line.
export function detectPort(line: string): number | null {
  for (const pattern of PORT_PATTERNS) {
    const match = line.match(pattern);
    if (match && match[1]) {
      const port = parseInt(match[1], 10);
      if (port >= 1000 && port <= 65535) {
        return port;
      }
    }
  }

  return null;
}

// Detect whether a line should count as an error signal.
export function isErrorLine(line: string): boolean {
  return ERROR_PATTERNS.some((pattern) => pattern.test(line));
}

// Detect whether a line indicates successful build/startup.
export function isSuccessLine(line: string): boolean {
  return SUCCESS_PATTERNS.some((pattern) => pattern.test(line));
}

// Enforce a hard cap so logs stay bounded over long-running sessions.
export function truncateLogFile(logPath: string): void {
  try {
    const stat = statSync(logPath);
    if (stat.size <= MAX_LOG_SIZE_BYTES) {
      return;
    }

    const output = spawnSync("tail", ["-c", String(TRUNCATE_TO_SIZE_BYTES), logPath]);
    if (output.status === 0) {
      writeFileSync(logPath, output.stdout);
    }
  } catch {
    // Ignore file-not-found or `tail` failures.
  }
}

// Update metadata from one line of log output.
export function applyLineToSessionMeta(meta: SessionMeta, line: string): boolean {
  let changed = false;

  if (meta.port === null) {
    const port = detectPort(line);
    if (port) {
      meta.port = port;
      changed = true;
    }
  }

  if (isSuccessLine(line)) {
    meta.errorCount = 0;
    meta.lastError = null;
    meta.lastErrorAt = null;
    meta.lastSuccessAt = new Date().toISOString();
    changed = true;
  }

  if (isErrorLine(line)) {
    meta.errorCount++;
    meta.lastError = line.slice(0, 200);
    meta.lastErrorAt = new Date().toISOString();
    changed = true;
  }

  return changed;
}
