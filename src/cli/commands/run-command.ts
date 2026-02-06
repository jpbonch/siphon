import { existsSync, readFileSync } from "fs";
import { spawn } from "child_process";
import { ensureSiphonDir } from "../config/paths";
import { LOG_MONITOR_INTERVAL_MS } from "../config/logging";
import type { SessionMeta } from "../types";
import { quoteShellArg } from "../utils/shell";
import { getSessionName } from "../session/name";
import { getSessionPaths } from "../session/paths";
import { applyLineToSessionMeta, truncateLogFile } from "../session/log-analysis";
import { writeMeta } from "../session/meta-store";

// Core wrapper command used by `siphon -- ...`, `siphon dev`, and legacy invocation.
export async function runCommand(args: string[], sessionNameOverride?: string): Promise<void> {
  ensureSiphonDir();

  const cwd = process.cwd();
  const sessionName = sessionNameOverride || getSessionName(cwd, args);
  const { logPath, metaPath } = getSessionPaths(sessionName);

  const meta: SessionMeta = {
    session: sessionName,
    command: args.join(" "),
    cwd,
    started: new Date().toISOString(),
    pid: 0,
    status: "running",
    exitCode: null,
    port: null,
    errorCount: 0,
    lastError: null,
    lastErrorAt: null,
    lastSuccessAt: null,
  };

  console.error(`[siphon] Session: ${sessionName}`);
  console.error(`[siphon] Logging to ${logPath}`);

  // Use shell + tee so terminal behavior matches direct execution while still capturing logs.
  const command = args.map(quoteShellArg).join(" ");
  const wrappedCommand = `set -o pipefail; (${command}) 2>&1 | tee "${logPath}"`;

  const proc = spawn("sh", ["-c", wrappedCommand], {
    stdio: "inherit",
  });

  meta.pid = proc.pid;
  writeMeta(metaPath, meta);

  // Forward host signals to child process.
  process.on("SIGINT", () => proc.kill("SIGINT"));
  process.on("SIGTERM", () => proc.kill("SIGTERM"));

  // Parse new log lines while command is running to keep metadata live.
  let lastProcessedLine = 0;
  const monitorInterval = setInterval(() => {
    try {
      truncateLogFile(logPath);
      if (!existsSync(logPath)) {
        return;
      }

      const lines = readFileSync(logPath, "utf-8").split("\n");
      let hasMetaUpdates = false;

      for (let i = lastProcessedLine; i < lines.length; i++) {
        if (applyLineToSessionMeta(meta, lines[i])) {
          hasMetaUpdates = true;
        }
      }

      lastProcessedLine = lines.length;

      if (hasMetaUpdates) {
        writeMeta(metaPath, meta);
      }
    } catch {
      // Ignore monitoring failures so wrapped command can continue.
    }
  }, LOG_MONITOR_INTERVAL_MS);

  // Wait for wrapped command to exit and preserve non-zero exit codes.
  const exitCode = await new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 1));
  });

  clearInterval(monitorInterval);

  // Final pass over log in case last lines arrived after the last polling cycle.
  try {
    truncateLogFile(logPath);

    if (existsSync(logPath)) {
      const lines = readFileSync(logPath, "utf-8").split("\n");
      for (const line of lines) {
        applyLineToSessionMeta(meta, line);
      }
    }
  } catch {
    // Ignore missing/unreadable log file after process exit.
  }

  meta.status = "exited";
  meta.exitCode = exitCode;
  writeMeta(metaPath, meta);

  process.exit(exitCode);
}
