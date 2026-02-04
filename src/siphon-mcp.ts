#!/usr/bin/env bun
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readdirSync, readFileSync, existsSync, writeFileSync } from "fs";
import { execSync } from "child_process";
import { homedir } from "os";
import { join } from "path";
import { z } from "zod";
import { extractErrors, generateHint, type ParsedError, type SessionMeta } from "./errors.js";

const SIPHON_DIR = `${homedir()}/.siphon`;

// ============================================================================
// Types
// ============================================================================

interface FullSessionMeta {
  session: string;
  command: string;
  cwd: string;
  started: string;
  pid: number;
  status: "running" | "exited";
  exitCode: number | null;
  port: number | null;
  errorCount: number;
  lastError: string | null;
  lastErrorAt: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readMeta(metaPath: string): FullSessionMeta | null {
  try {
    const content = readFileSync(metaPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writeMeta(metaPath: string, meta: FullSessionMeta): void {
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getAllSessions(): Array<{ meta: FullSessionMeta; metaPath: string; logPath: string }> {
  if (!existsSync(SIPHON_DIR)) {
    return [];
  }

  const files = readdirSync(SIPHON_DIR).filter((f) => f.endsWith(".meta.json"));
  const sessions: Array<{ meta: FullSessionMeta; metaPath: string; logPath: string }> = [];

  for (const file of files) {
    const metaPath = join(SIPHON_DIR, file);
    const meta = readMeta(metaPath);
    if (!meta) continue;

    const logPath = metaPath.replace(".meta.json", ".log");

    // Check for stale sessions
    if (meta.status === "running" && !isPidAlive(meta.pid)) {
      meta.status = "exited";
      meta.exitCode = null;
      writeMeta(metaPath, meta);
    }

    sessions.push({ meta, metaPath, logPath });
  }

  return sessions;
}

function fuzzyMatchSession(
  sessions: Array<{ meta: FullSessionMeta; metaPath: string; logPath: string }>,
  query: string
): Array<{ meta: FullSessionMeta; metaPath: string; logPath: string }> {
  // Exact match
  const exact = sessions.filter((s) => s.meta.session === query);
  if (exact.length > 0) return exact;

  // Prefix match
  const prefix = sessions.filter((s) => s.meta.session.startsWith(query));
  if (prefix.length > 0) return prefix;

  // Contains match
  const contains = sessions.filter((s) => s.meta.session.includes(query));
  return contains;
}

function getLastNLines(logPath: string, n: number): string {
  try {
    const output = execSync(`tail -n ${n} "${logPath}"`, { encoding: "utf-8" });
    return output;
  } catch {
    return "";
  }
}

// ============================================================================
// MCP Server
// ============================================================================

const server = new McpServer({
  name: "siphon",
  version: "1.0.0",
});

// ============================================================================
// Tool: check_status
// ============================================================================

server.tool(
  "check_status",
  `Quick health check across all running dev processes. Returns what's running,
what's crashed, and any recent errors with stack traces.

CALL THIS TOOL:
- After making code changes to verify they worked
- When the user says something is "broken", "not working", or "crashing"
- Before investigating any runtime issue
- When starting a debugging task to understand current state
- After a previous fix attempt to confirm it resolved the issue

This is the most useful tool for understanding what's happening in the application right now.`,
  {
    session: z.string().optional().describe(
      "Filter to a specific session name. If omitted, shows all sessions."
    ),
  },
  async ({ session }) => {
    let sessions = getAllSessions();

    if (sessions.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No siphon sessions found.

To start capturing output, run your dev server with siphon:
  siphon -- npm run dev

Or run 'siphon init' to set up automatic capture for this project.`,
          },
        ],
      };
    }

    // Filter by session name if provided
    if (session) {
      const matched = fuzzyMatchSession(sessions, session);
      if (matched.length === 0) {
        const available = sessions.map((s) => s.meta.session).join(", ");
        return {
          content: [
            {
              type: "text",
              text: `Session '${session}' not found. Available sessions: ${available}`,
            },
          ],
        };
      }
      sessions = matched;
    }

    const output: string[] = [];
    const allErrors: ParsedError[] = [];
    const sessionMetas: SessionMeta[] = [];

    for (const { meta, logPath } of sessions) {
      // Build status line
      const startedDate = new Date(meta.started);
      const ago = formatTimeAgo(startedDate);
      const portInfo = meta.port ? `port ${meta.port}, ` : "";
      const pidInfo = `pid ${meta.pid}`;

      let statusLine: string;
      if (meta.status === "running") {
        statusLine = `${meta.session} — running (${portInfo}${pidInfo}, started ${ago})`;
      } else {
        const exitInfo = meta.exitCode !== null ? `with code ${meta.exitCode}` : "(stale — process no longer running)";
        statusLine = `${meta.session} — exited ${exitInfo} (stopped ${ago})`;
      }
      output.push(statusLine);

      // Extract errors from log
      const logContent = getLastNLines(logPath, 200);
      const errors = extractErrors(logContent);

      // Limit to 5 errors per session
      const limitedErrors = errors.slice(-5);
      const moreErrors = errors.length - limitedErrors.length;

      if (limitedErrors.length > 0) {
        output.push(`  ⚠ ${errors.length} error${errors.length !== 1 ? "s" : ""} detected:`);
        output.push("");

        for (const error of limitedErrors) {
          const timestamp = error.timestamp ? `[${error.timestamp}] ` : "";
          output.push(`  ${timestamp}${error.type}: ${error.message}`);
          for (const frame of error.stack.slice(0, 5)) {
            output.push(`    ${frame}`);
          }
          if (error.stack.length > 5) {
            output.push(`    ... and ${error.stack.length - 5} more frames`);
          }
          output.push("");
        }

        if (moreErrors > 0) {
          output.push(`  ... and ${moreErrors} more errors — use get_output for full logs`);
          output.push("");
        }

        allErrors.push(...errors);
      } else {
        output.push("  ✓ No errors detected");
        output.push("");
      }

      output.push("---");

      sessionMetas.push({
        session: meta.session,
        status: meta.status,
        exitCode: meta.exitCode,
        port: meta.port,
        errorCount: meta.errorCount,
      });
    }

    // Generate hint
    const hint = generateHint(allErrors, sessionMetas);
    if (hint) {
      output.push(`hint: ${hint}`);
    }

    return {
      content: [
        {
          type: "text",
          text: output.join("\n"),
        },
      ],
    };
  }
);

// ============================================================================
// Tool: get_output
// ============================================================================

server.tool(
  "get_output",
  `Get raw log output from a siphon session. Use when check_status doesn't
provide enough detail — for example, to see the full sequence of events
leading to an error, to search for specific output, or to see non-error
output like build results.

Usually check_status is sufficient. Use this for deeper investigation.`,
  {
    name: z.string().describe("Session name (e.g. 'my-app:dev')"),
    lines: z.number().default(100).describe("Number of lines to retrieve"),
    grep: z.string().optional().describe(
      "Filter output to lines containing this string (case-insensitive)"
    ),
  },
  async ({ name, lines, grep }) => {
    const sessions = getAllSessions();

    if (sessions.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "No siphon sessions found. Run 'siphon -- <command>' to start capturing output.",
          },
        ],
      };
    }

    const matched = fuzzyMatchSession(sessions, name);

    if (matched.length === 0) {
      const available = sessions.map((s) => s.meta.session).join("\n  ");
      return {
        content: [
          {
            type: "text",
            text: `Session '${name}' not found.\n\nAvailable sessions:\n  ${available}`,
          },
        ],
      };
    }

    if (matched.length > 1) {
      const matches = matched.map((s) => s.meta.session).join("\n  ");
      return {
        content: [
          {
            type: "text",
            text: `Multiple sessions match '${name}'. Please be more specific:\n  ${matches}`,
          },
        ],
      };
    }

    const { meta, logPath } = matched[0];

    if (!existsSync(logPath)) {
      return {
        content: [
          {
            type: "text",
            text: `Log file not found for session '${meta.session}'`,
          },
        ],
      };
    }

    let output = getLastNLines(logPath, lines);

    // Apply grep filter if provided
    if (grep) {
      const grepLower = grep.toLowerCase();
      const filteredLines = output.split("\n").filter((line) =>
        line.toLowerCase().includes(grepLower)
      );
      output = filteredLines.join("\n");

      if (filteredLines.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No lines matching '${grep}' in the last ${lines} lines of ${meta.session}`,
            },
          ],
        };
      }
    }

    return {
      content: [
        {
          type: "text",
          text: `=== ${meta.session} (last ${lines} lines${grep ? `, filtered for '${grep}'` : ""}) ===\n\n${output}`,
        },
      ],
    };
  }
);

// ============================================================================
// Start Server
// ============================================================================

const transport = new StdioServerTransport();
server.connect(transport);
