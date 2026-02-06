import { basename } from "path";

// Build a stable session name from cwd + command intent.
export function getSessionName(cwd: string, args: string[]): string {
  const dirName = basename(cwd);
  const commandShortname = extractCommandShortname(args);
  return `${dirName}:${commandShortname}`;
}

// Normalize a command into a human-readable short label.
export function extractCommandShortname(args: string[]): string {
  if (args.length === 0) return "session";

  const cmd = args[0];
  const restArgs = args.slice(1);

  if (/^(npm|bun|yarn|pnpm)$/.test(cmd)) {
    if (restArgs[0] === "run" && restArgs[1]) {
      return restArgs[1];
    }

    if (restArgs[0] && !restArgs[0].startsWith("-")) {
      return restArgs[0];
    }
  }

  if (/^python3?$/.test(cmd) && restArgs[0]) {
    const pyFile = restArgs[0];
    if (pyFile.endsWith(".py")) {
      return basename(pyFile, ".py");
    }
  }

  if (cmd === "node" && restArgs[0]) {
    const nodeFile = restArgs[0];
    const ext = nodeFile.match(/\.(js|ts|mjs|mts)$/);
    if (ext) {
      return basename(nodeFile, ext[0]);
    }
  }

  if ((cmd === "cargo" || cmd === "go") && restArgs[0]) {
    return restArgs[0];
  }

  const lastArg = args[args.length - 1];
  if (lastArg) {
    const stripped = lastArg.replace(/\.[^.]+$/, "");
    return basename(stripped) || "session";
  }

  return "session";
}
