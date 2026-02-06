import { existsSync } from "fs";
import { join } from "path";
import {
  FALLBACK_PROJECT_RUNNERS,
  NO_DEV_COMMAND_HINT,
  PYTHON_MANUAL_RUN_HINT,
  PYTHON_PROJECT_MARKER,
} from "../config/dev";
import { detectDevScript } from "../session/dev-detection";
import { runCommand } from "./run-command";

// Run the best detected dev command for the current project.
export async function runDevCommand(): Promise<void> {
  const cwd = process.cwd();
  const devInfo = detectDevScript(cwd);

  if (devInfo) {
    const { pm, script } = devInfo;
    console.error(`[siphon] Running: ${pm} run ${script}`);
    await runCommand([pm, "run", script]);
    return;
  }

  for (const runner of FALLBACK_PROJECT_RUNNERS) {
    if (existsSync(join(cwd, runner.markerFile))) {
      console.error(runner.message);
      await runCommand(runner.command);
      return;
    }
  }

  if (existsSync(join(cwd, PYTHON_PROJECT_MARKER))) {
    console.error(PYTHON_MANUAL_RUN_HINT);
    process.exit(1);
  }

  console.error(NO_DEV_COMMAND_HINT);
  process.exit(1);
}
