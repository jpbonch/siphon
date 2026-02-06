import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import {
  appendInstructions,
  detectAgentFromEnvironment,
  detectAgentsInProject,
  getAgentById,
  getAllAgentIds,
  writeMcpConfig,
} from "../../agents";
import { SIPHON_INSTRUCTIONS } from "../config/init";
import { detectDevScript } from "../session/dev-detection";
import { hasProjectFiles, wrapDevScript } from "../session/project-detection";
import { prompt } from "../utils/prompt";
import type { InitOptions } from "../types";

interface PackageJsonShape {
  scripts?: Record<string, string>;
}

function getScriptCommand(cwd: string, scriptName: string): string | null {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return null;
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as PackageJsonShape;
    return pkg.scripts?.[scriptName] ?? null;
  } catch {
    return null;
  }
}

function getAgentDisplayName(agentId: string): string {
  return getAgentById(agentId)?.displayName ?? agentId;
}

// Set up package scripts, MCP config, and local agent instructions.
export async function initProject(options: InitOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const isInteractive = process.stdin.isTTY ?? false;

  if (!hasProjectFiles(cwd)) {
    console.log(`No project files detected in this directory.

Siphon works best when initialized in a project directory.
You can still use siphon manually:
  siphon -- <any command>

Run 'siphon init' again once your project is set up.`);
    return;
  }

  const actionsList: string[] = [];
  let selectedAgentIds = detectAgentsInProject(cwd);

  // Wrap the detected dev script to ensure future runs are automatically captured.
  const devInfo = detectDevScript(cwd);
  if (devInfo) {
    const currentScript = getScriptCommand(cwd, devInfo.script);

    if (currentScript && !currentScript.startsWith("siphon ")) {
      console.log(`Detected dev command: "${currentScript}" (from package.json "${devInfo.script}" script)`);

      let shouldWrap = false;
      if (options.yes || !isInteractive) {
        shouldWrap = true;
        console.log("Auto-wrapping dev command with siphon.");
      } else {
        const answer = await prompt("Wrap it with siphon so output is automatically captured? (y/n) ");
        shouldWrap = ["y", "yes"].includes(answer.toLowerCase());
      }

      if (shouldWrap && wrapDevScript(cwd)) {
        actionsList.push(`Wrapped "${devInfo.script}" script with siphon in package.json`);
      }
    } else if (currentScript?.startsWith("siphon ")) {
      console.log("Dev script already wrapped with siphon.");
    }
  }

  // Pick which coding agent(s) to configure.
  if (selectedAgentIds.length === 0) {
    if (options.agent) {
      if (options.agent === "both") {
        selectedAgentIds = getAllAgentIds();
        const display = selectedAgentIds.map(getAgentDisplayName).join(" and ");
        console.log(`Configuring for ${display} (specified via --agent).`);
      } else {
        selectedAgentIds = [options.agent];
        console.log(`Configuring for ${getAgentDisplayName(options.agent)} (specified via --agent).`);
      }
    } else if (!isInteractive) {
      const envAgentId = detectAgentFromEnvironment();
      if (envAgentId) {
        selectedAgentIds = [envAgentId];
        console.log(`Auto-detected ${getAgentDisplayName(envAgentId)} environment. Configuring for ${getAgentDisplayName(envAgentId)}.`);
      } else {
        selectedAgentIds = ["claude"];
        console.log("Non-interactive mode: defaulting to Claude Code configuration.");
      }
    } else {
      console.log(`
No coding agent configuration detected. Which do you use?
  1. Claude Code
  2. Cursor
  3. Both
  4. Other / Skip (you can run 'siphon init' again later)
`);

      const answer = await prompt("Enter choice (1-4): ");
      switch (answer) {
        case "1":
          selectedAgentIds = ["claude"];
          break;
        case "2":
          selectedAgentIds = ["cursor"];
          break;
        case "3":
          selectedAgentIds = getAllAgentIds();
          break;
        default:
          console.log("\nSkipped agent configuration. Run 'siphon init' again any time to add it.");
          if (actionsList.length > 0) {
            console.log("\n" + actionsList.map((action) => `✓ ${action}`).join("\n"));
          }
          return;
      }
    }
  } else {
    const detectedNames = selectedAgentIds.map(getAgentDisplayName);
    console.log(`Detected coding agents: ${detectedNames.join(", ")}`);
  }

  // Configure MCP globally for each chosen agent.
  for (const agentId of selectedAgentIds) {
    const agent = getAgentById(agentId);
    if (!agent) continue;

    if (writeMcpConfig(agent)) {
      actionsList.push(`Added MCP server config to ${agent.globalConfigPath.replace(homedir(), "~")}`);
    }
  }

  // Add project-level instructions to guide runtime-aware debugging workflows.
  for (const agentId of selectedAgentIds) {
    const agent = getAgentById(agentId);
    if (!agent) continue;

    if (appendInstructions(agent, cwd, SIPHON_INSTRUCTIONS)) {
      actionsList.push(`Added debugging instructions to ${agent.instructionsFile}`);
    }
  }

  if (actionsList.length > 0) {
    console.log("\n" + actionsList.map((action) => `✓ ${action}`).join("\n"));
    console.log(`\nReady! Run '${devInfo ? `${devInfo.pm} run ${devInfo.script}` : "your dev command"}' to start with siphon enabled.`);
    console.log("Tip: Run 'siphon init' again any time to update configuration.");
  } else {
    console.log("\nNothing to configure — siphon is already set up.");
  }
}
