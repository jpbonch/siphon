import { exec } from "child_process";
import { promisify } from "util";
import {
  DEV_PORT_MAX,
  DEV_PORT_MIN,
  DEV_PROCESS_NAMES,
  LISTENING_PROCESS_COMMAND,
} from "../config/processes";
import type { UncapturedProcess } from "../types";

const execAsync = promisify(exec);

// Find likely dev servers running outside siphon capture.
export async function detectUncapturedProcesses(siphonPorts: Set<number>): Promise<UncapturedProcess[]> {
  try {
    const { stdout } = await execAsync(LISTENING_PROCESS_COMMAND);
    const results: UncapturedProcess[] = [];

    for (const line of stdout.split("\n")) {
      if (process.platform === "darwin") {
        const match = line.match(
          /^(\S+)\s+(\d+)\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\*:(\d+)/
        );

        if (!match) continue;

        const rawCommand = match[1];
        const command = rawCommand.toLowerCase();
        const pid = parseInt(match[2], 10);
        const port = parseInt(match[3], 10);

        if (
          port >= DEV_PORT_MIN &&
          port <= DEV_PORT_MAX &&
          !siphonPorts.has(port) &&
          DEV_PROCESS_NAMES.some((candidate) => command.includes(candidate))
        ) {
          results.push({ command: rawCommand, pid, port });
        }

        continue;
      }

      const portMatch = line.match(/\*:(\d+)/);
      const processMatch = line.match(/\(\("([^"]+)",pid=(\d+)/);

      if (!portMatch || !processMatch) {
        continue;
      }

      const port = parseInt(portMatch[1], 10);
      const command = processMatch[1].toLowerCase();
      const pid = parseInt(processMatch[2], 10);

      if (
        port >= DEV_PORT_MIN &&
        port <= DEV_PORT_MAX &&
        !siphonPorts.has(port) &&
        DEV_PROCESS_NAMES.some((candidate) => command.includes(candidate))
      ) {
        results.push({ command: processMatch[1], pid, port });
      }
    }

    return results;
  } catch {
    return [];
  }
}
