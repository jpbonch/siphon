import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CHECK_STATUS_LOG_TAIL_LINES, CHECK_STATUS_MAX_ERRORS_PER_SESSION } from "../config/tools";
import { CHECK_STATUS_TOOL_DESCRIPTION } from "../config/messages";
import { detectUncapturedProcesses } from "../process/detect-uncaptured";
import { getProductionContextLines } from "../production/context";
import { detectProjectSetup } from "../project/setup";
import { fuzzyMatchSession } from "../sessions/match";
import { getLastNLines } from "../sessions/output";
import { getAllSessions } from "../sessions/store";
import { formatTimeAgo, stripAnsi } from "../utils";
import { extractErrors, generateHint } from "../../errors";
import type { ParsedError, SessionMeta } from "../../errors";

function buildNoSessionMessage(uncapturedProcessLines: string): string {
  const setup = detectProjectSetup(process.cwd());

  if (setup.hasProject && setup.hasDevScript && !setup.isWrapped) {
    return (
      "No siphon sessions found.\n\n" +
      "This project hasn't been set up with siphon yet. Run this command to enable automatic runtime monitoring:\n\n" +
      "  siphon init --yes --agent claude\n\n" +
      "Then restart the dev server. After that, check_status will show runtime errors automatically." +
      uncapturedProcessLines
    );
  }

  if (setup.hasProject && setup.isWrapped) {
    return (
      "No siphon sessions running. The dev server may not be started.\n\n" +
      "Start it with:\n" +
      "  siphon dev" +
      uncapturedProcessLines
    );
  }

  return (
    "No siphon sessions found.\n\n" +
    "To start capturing output, run your dev server with siphon:\n" +
    "  siphon -- npm run dev\n\n" +
    "Or run 'siphon init --yes --agent claude' to set up automatic capture for this project." +
    uncapturedProcessLines
  );
}

function formatUncapturedProcessLines(processes: Array<{ port: number; command: string; pid: number; fullArgs?: string }>): string[] {
  const lines: string[] = [];
  lines.push("⚠ Dev processes running WITHOUT siphon:");

  for (const proc of processes) {
    lines.push(`  port ${proc.port} — ${proc.command} (pid ${proc.pid})`);
    if (proc.fullArgs) {
      lines.push(`    command: ${proc.fullArgs}`);
    }
  }

  lines.push("");
  lines.push("  To capture this process, it needs to be restarted through siphon.");
  lines.push("  Ask the user if they want to restart it:");

  for (const proc of processes) {
    const cmd = proc.fullArgs || "<original command>";
    lines.push(`    kill ${proc.pid} && siphon -- ${cmd}`);
  }

  return lines;
}

function buildUncapturedProcessBlock(processes: Array<{ port: number; command: string; pid: number; fullArgs?: string }>): string {
  if (processes.length === 0) {
    return "";
  }

  return "\n\n---\n\n" + formatUncapturedProcessLines(processes).join("\n");
}

// Register `check_status` tool on the provided MCP server.
export function registerCheckStatusTool(server: McpServer): void {
  server.tool(
    "check_status",
    CHECK_STATUS_TOOL_DESCRIPTION,
    {
      session: z.string().optional().describe("Filter to a specific session name. If omitted, shows all sessions."),
    },
    async ({ session }) => {
      let sessions = getAllSessions();

      const siphonPorts = new Set<number>();
      for (const { meta } of sessions) {
        if (meta.port) {
          siphonPorts.add(meta.port);
        }
      }

      const uncapturedProcesses = await detectUncapturedProcesses(siphonPorts);

      if (sessions.length === 0) {
        const uncapturedProcessLines = buildUncapturedProcessBlock(uncapturedProcesses);
        const productionContextLines = await getProductionContextLines({
          errors: [],
          sessions: [],
        });
        const productionContextBlock = `\n\n${productionContextLines.join("\n")}`;

        return {
          content: [
            {
              type: "text",
              text: `${buildNoSessionMessage(uncapturedProcessLines)}${productionContextBlock}`,
            },
          ],
        };
      }

      if (session) {
        const matched = fuzzyMatchSession(sessions, session);
        if (matched.length === 0) {
          const available = sessions.map((candidate) => candidate.meta.session).join(", ");
          const productionContextLines = await getProductionContextLines({
            errors: [],
            sessions: [],
          });
          const productionContextBlock = `\n\n${productionContextLines.join("\n")}`;
          return {
            content: [
              {
                type: "text",
                text: `Session '${session}' not found. Available sessions: ${available}${productionContextBlock}`,
              },
            ],
          };
        }

        sessions = matched;
      }

      const output: string[] = [];
      const allErrors: ParsedError[] = [];
      const sessionMetas: SessionMeta[] = [];
      let latestErrorAt: string | null = null;
      let latestSuccessAt: string | null = null;

      for (const { meta, logPath } of sessions) {
        const ago = formatTimeAgo(new Date(meta.started));
        const portInfo = meta.port ? `port ${meta.port}, ` : "";
        const pidInfo = `pid ${meta.pid}`;

        if (meta.status === "running") {
          output.push(`${meta.session} — running (${portInfo}${pidInfo}, started ${ago})`);
        } else {
          const exitInfo =
            meta.exitCode !== null
              ? `with code ${meta.exitCode}`
              : "(stale — process no longer running)";
          output.push(`${meta.session} — exited ${exitInfo} (stopped ${ago})`);
        }

        if (meta.lastErrorAt && (!latestErrorAt || meta.lastErrorAt > latestErrorAt)) {
          latestErrorAt = meta.lastErrorAt;
        }

        if (meta.lastSuccessAt && (!latestSuccessAt || meta.lastSuccessAt > latestSuccessAt)) {
          latestSuccessAt = meta.lastSuccessAt;
        }

        const rawLogContent = getLastNLines(logPath, CHECK_STATUS_LOG_TAIL_LINES);
        const logContent = stripAnsi(rawLogContent);
        const errors = extractErrors(logContent);
        const limitedErrors = errors.slice(-CHECK_STATUS_MAX_ERRORS_PER_SESSION);
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

      let hint = generateHint(allErrors, sessionMetas);
      if (hint && latestErrorAt) {
        const errorAge = Date.now() - new Date(latestErrorAt).getTime();
        const ageMinutes = Math.floor(errorAge / 60000);

        if (latestSuccessAt && latestSuccessAt > latestErrorAt) {
          hint += " (build succeeded since last error — errors may be resolved)";
        } else if (ageMinutes > 5) {
          hint += ` (last error ${ageMinutes}m ago — may already be resolved)`;
        }
      }

      if (hint) {
        output.push(`hint: ${hint}`);
      }

      if (uncapturedProcesses.length > 0) {
        output.push("");
        output.push(...formatUncapturedProcessLines(uncapturedProcesses));
      }

      const productionContextLines = await getProductionContextLines({
        errors: allErrors,
        sessions: sessionMetas,
      });
      output.push("");
      output.push(...productionContextLines);

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
}
