import type { ParsedError, SessionMeta } from "./types";

// Create a concise next-step hint from extracted errors and session states.
export function generateHint(errors: ParsedError[], sessions: SessionMeta[]): string {
  if (errors.length === 0) {
    const allRunning = sessions.every((session) => session.status === "running");

    if (allRunning && sessions.length > 0) {
      return "All processes running normally. No errors in recent output.";
    }

    return "";
  }

  const parts: string[] = [];
  const latest = errors[errors.length - 1];

  parts.push(`Most recent error: ${latest.type}: ${latest.message.replace(/ \(×\d+\)$/, "")}`);

  if (latest.stack.length > 0) {
    const topFrame = latest.stack[0];
    const fileMatch =
      topFrame.match(/\((.+):(\d+):\d+\)/) ||
      topFrame.match(/at (.+):(\d+):\d+/) ||
      topFrame.match(/File "(.+)", line (\d+)/);

    if (fileMatch) {
      parts.push(`Consider investigating ${fileMatch[1]} around line ${fileMatch[2]}.`);
    }
  }

  if (latest.message.includes("ECONNREFUSED") || latest.type === "ECONNREFUSED") {
    const portMatch = latest.message.match(/:(\d+)/);
    parts.push(`Check if the service on port ${portMatch?.[1] ?? "?"} is running.`);
  }

  if (latest.type === "SyntaxError") {
    parts.push("This is likely a syntax issue in the source code.");
  }

  if (latest.message.includes("EADDRINUSE") || latest.type === "EADDRINUSE") {
    parts.push("The port is already in use. Kill the existing process or use a different port.");
  }

  if (latest.message.includes("ENOENT") || latest.type === "ENOENT") {
    parts.push("A file or directory was not found. Check that all paths exist.");
  }

  if (latest.type === "TypeError" && latest.message.includes("undefined")) {
    parts.push("A value is undefined when it shouldn't be. Check for null/undefined handling.");
  }

  const crashed = sessions.filter((session) => session.status === "exited" && session.exitCode !== 0);
  if (crashed.length > 0) {
    parts.push(`${crashed.length} process(es) have crashed and may need restart.`);
  }

  return parts.join(" ");
}
