import { ensureSiphonDir } from "./config/paths";
import { CLI_USAGE_TEXT } from "./config/usage";
import type { CleanOptions, InitOptions } from "./types";
import { cleanSessions } from "./session/clean";
import { listSessions } from "./session/list";
import { runCommand } from "./commands/run-command";
import { runDevCommand } from "./commands/dev";
import { initProject } from "./commands/init";
import { runLoginCommand } from "./commands/login";
import { getAllAgentIds } from "../agents";

function printUsage(): void {
  console.log(CLI_USAGE_TEXT);
}

function parseInitOptions(args: string[]): InitOptions {
  const options: InitOptions = {};
  const validAgentIds = getAllAgentIds();
  const validAgents = new Set(["both", ...validAgentIds]);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--yes" || arg === "-y") {
      options.yes = true;
      continue;
    }

    if (arg === "--agent" && args[i + 1]) {
      const requestedAgent = args[i + 1].toLowerCase();
      if (!validAgents.has(requestedAgent)) {
        console.error(
          `Invalid agent: ${args[i + 1]}. Must be one of: ${[...validAgentIds, "both"].join(", ")}`
        );
        process.exit(1);
      }

      options.agent = requestedAgent;
      i++;
    }
  }

  return options;
}

function parseCleanOptions(args: string[]): CleanOptions {
  const options: CleanOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--all") {
      options.all = true;
      continue;
    }

    if (arg === "--days" && args[i + 1]) {
      options.days = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return options;
}

// Main CLI dispatcher.
export async function runCli(argv: string[]): Promise<void> {
  ensureSiphonDir();

  const args = argv;
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const firstArg = args[0];

  switch (firstArg) {
    case "init": {
      await initProject(parseInitOptions(args.slice(1)));
      break;
    }

    case "dev": {
      await runDevCommand();
      break;
    }

    case "login": {
      await runLoginCommand();
      break;
    }

    case "list": {
      listSessions();
      break;
    }

    case "clean": {
      cleanSessions(parseCleanOptions(args.slice(1)));
      break;
    }

    case "--": {
      const cmdArgs = args.slice(1);
      if (cmdArgs.length === 0) {
        console.error("Error: No command specified after --");
        process.exit(1);
      }

      await runCommand(cmdArgs);
      break;
    }

    case "--name": {
      const sessionName = args[1];
      const separatorIndex = args.indexOf("--", 2);

      if (!sessionName || separatorIndex === -1) {
        console.error("Usage: siphon --name <name> -- <command>");
        process.exit(1);
      }

      const cmdArgs = args.slice(separatorIndex + 1);
      if (cmdArgs.length === 0) {
        console.error("Error: No command specified after --");
        process.exit(1);
      }

      await runCommand(cmdArgs, sessionName);
      break;
    }

    default: {
      // Keep backwards compatibility: treat unknown form as wrapped command.
      await runCommand(args);
      break;
    }
  }
}
