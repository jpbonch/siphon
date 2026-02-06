import { existsSync } from "fs";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { GET_OUTPUT_DEFAULT_LINES } from "../config/tools";
import { GET_OUTPUT_TOOL_DESCRIPTION } from "../config/messages";
import { fuzzyMatchSession } from "../sessions/match";
import { getLastNLines } from "../sessions/output";
import { getAllSessions } from "../sessions/store";
import { stripAnsi } from "../utils";

// Register `get_output` tool for raw per-session log access.
export function registerGetOutputTool(server: McpServer): void {
  server.tool(
    "get_output",
    GET_OUTPUT_TOOL_DESCRIPTION,
    {
      name: z.string().describe("Session name (e.g. 'my-app:dev')"),
      lines: z.number().default(GET_OUTPUT_DEFAULT_LINES).describe("Number of lines to retrieve"),
      grep: z
        .string()
        .optional()
        .describe("Filter output to lines containing this string (case-insensitive)"),
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
        const available = sessions.map((session) => session.meta.session).join("\n  ");
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
        const matches = matched.map((session) => session.meta.session).join("\n  ");
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

      let output = stripAnsi(getLastNLines(logPath, lines));

      if (grep) {
        const grepLower = grep.toLowerCase();
        const filteredLines = output
          .split("\n")
          .filter((line) => line.toLowerCase().includes(grepLower));

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

        output = filteredLines.join("\n");
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
}
