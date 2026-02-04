#!/usr/bin/env bun
import {
  existsSync,
  mkdirSync,
  createWriteStream,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "fs";
import { basename, join } from "path";
import { homedir } from "os";
import { spawn, spawnSync } from "child_process";
import * as readline from "readline";

const SIPHON_DIR = `${homedir()}/.siphon`;

// Ensure ~/.siphon exists
if (!existsSync(SIPHON_DIR)) {
  mkdirSync(SIPHON_DIR, { recursive: true });
}

// ============================================================================
// Types
// ============================================================================

interface SessionMeta {
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
  lastSuccessAt: string | null;
}

// ============================================================================
// Session Naming
// ============================================================================

function getSessionName(cwd: string, args: string[]): string {
  const dirName = basename(cwd);
  const commandShortname = extractCommandShortname(args);
  return `${dirName}:${commandShortname}`;
}

function extractCommandShortname(args: string[]): string {
  if (args.length === 0) return "session";

  const cmd = args[0];
  const restArgs = args.slice(1);

  // Package manager scripts: npm/bun/yarn/pnpm run? <script>
  if (/^(npm|bun|yarn|pnpm)$/.test(cmd)) {
    // Handle "npm run dev" or "npm dev"
    if (restArgs[0] === "run" && restArgs[1]) {
      return restArgs[1];
    }
    if (restArgs[0] && !restArgs[0].startsWith("-")) {
      return restArgs[0];
    }
  }

  // Python files: python3? <n>.py
  if (/^python3?$/.test(cmd) && restArgs[0]) {
    const pyFile = restArgs[0];
    if (pyFile.endsWith(".py")) {
      return basename(pyFile, ".py");
    }
  }

  // Node files: node <n>.js/ts
  if (cmd === "node" && restArgs[0]) {
    const nodeFile = restArgs[0];
    const ext = nodeFile.match(/\.(js|ts|mjs|mts)$/);
    if (ext) {
      return basename(nodeFile, ext[0]);
    }
  }

  // Cargo/Go subcommands: cargo/go <subcommand>
  if ((cmd === "cargo" || cmd === "go") && restArgs[0]) {
    return restArgs[0];
  }

  // Fallback: last argument with extension stripped, or "session"
  const lastArg = args[args.length - 1];
  if (lastArg) {
    const stripped = lastArg.replace(/\.[^.]+$/, "");
    return basename(stripped) || "session";
  }

  return "session";
}

function getSessionPaths(sessionName: string): { logPath: string; metaPath: string } {
  // Replace : with -- for Windows compatibility (though colons work on Mac/Linux)
  const safeName = process.platform === "win32" ? sessionName.replace(/:/g, "--") : sessionName;
  return {
    logPath: `${SIPHON_DIR}/${safeName}.log`,
    metaPath: `${SIPHON_DIR}/${safeName}.meta.json`,
  };
}

// ============================================================================
// Port Detection
// ============================================================================

const PORT_PATTERNS = [
  /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)[:\s]+(\d{4,5})/i,
  /:(\d{4,5})\b/,
  /port\s+(\d{4,5})/i,
  /listening\s+(?:on\s+)?(?:port\s+)?(\d{4,5})/i,
];

function detectPort(line: string): number | null {
  for (const pattern of PORT_PATTERNS) {
    const match = line.match(pattern);
    if (match && match[1]) {
      const port = parseInt(match[1], 10);
      if (port >= 1000 && port <= 65535) {
        return port;
      }
    }
  }
  return null;
}

// ============================================================================
// Error Detection (Inline)
// ============================================================================

const ERROR_PATTERNS = [
  /^(Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError):/,
  /E(CONNREFUSED|NOTFOUND|ACCES|ADDRINUSE|PERM|NOENT)/,
  /^Traceback \(most recent call last\)/,
  /panic:/,
  /^error\[E\d+\]/,
  /\b(FATAL|CRITICAL)\b/i,
  /^error:/i,
  /failed to compile/i,
  /compilation failed/i,
  /build failed/i,
  /UnhandledPromiseRejection/i,
  /Uncaught \w*Error/i,
];

function isErrorLine(line: string): boolean {
  return ERROR_PATTERNS.some((pattern) => pattern.test(line));
}

// ============================================================================
// Success Detection
// ============================================================================

const SUCCESS_PATTERNS = [
  /compiled successfully/i,
  /compiled client and server successfully/i,
  /ready in \d+m?s/i,
  /build completed/i,
  /watching for file changes/i,
  /compiled.*in \d+m?s/i,
  /webpack.*compiled/i,
  /vite.*ready/i,
  /✓ ready/i,
  /server started/i,
  /listening on/i,
];

function isSuccessLine(line: string): boolean {
  return SUCCESS_PATTERNS.some((pattern) => pattern.test(line));
}

// ============================================================================
// Log Size Capping
// ============================================================================

const MAX_LOG_SIZE = 1024 * 1024; // 1MB
const TRUNCATE_TO_SIZE = 512 * 1024; // 500KB

function truncateLogFile(logPath: string): void {
  try {
    const stat = statSync(logPath);
    if (stat.size > MAX_LOG_SIZE) {
      // Use tail to keep only the last ~500KB
      const output = spawnSync("tail", ["-c", String(TRUNCATE_TO_SIZE), logPath]);
      if (output.status === 0) {
        writeFileSync(logPath, output.stdout);
      }
    }
  } catch {
    // Ignore errors - file may not exist yet or truncation failed
  }
}

// ============================================================================
// Metadata Management
// ============================================================================

function writeMeta(metaPath: string, meta: SessionMeta): void {
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

function readMeta(metaPath: string): SessionMeta | null {
  try {
    const content = readFileSync(metaPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Main Command Runner
// ============================================================================

async function runCommand(args: string[], sessionNameOverride?: string): Promise<void> {
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

  // Use shell-level tee to capture output reliably
  // This avoids stream timing issues in Node/Bun
  // Quote arguments that contain spaces or special characters
  const quoteArg = (arg: string): string => {
    if (/["\s;|&$`\\]/.test(arg)) {
      // Escape single quotes and wrap in single quotes
      return `'${arg.replace(/'/g, "'\\''")}'`;
    }
    return arg;
  };
  const command = args.map(quoteArg).join(" ");
  // Use pipefail to preserve exit code through tee
  const wrappedCommand = `set -o pipefail; (${command}) 2>&1 | tee "${logPath}"`;

  const proc = spawn("sh", ["-c", wrappedCommand], {
    stdio: "inherit",
  });

  meta.pid = proc.pid;
  writeMeta(metaPath, meta);

  // Signal forwarding
  process.on("SIGINT", () => proc.kill("SIGINT"));
  process.on("SIGTERM", () => proc.kill("SIGTERM"));

  // Background log monitoring for real-time error/success detection
  let lastProcessedLine = 0;
  const monitorInterval = setInterval(() => {
    try {
      // Cap log size periodically
      truncateLogFile(logPath);

      if (!existsSync(logPath)) return;

      const logContent = readFileSync(logPath, "utf-8");
      const lines = logContent.split("\n");

      // Only process new lines since last check
      for (let i = lastProcessedLine; i < lines.length; i++) {
        const line = lines[i];

        // Port detection
        if (meta.port === null) {
          const port = detectPort(line);
          if (port) {
            meta.port = port;
            writeMeta(metaPath, meta);
          }
        }

        // Success detection - reset error state when build succeeds
        if (isSuccessLine(line)) {
          meta.errorCount = 0;
          meta.lastError = null;
          meta.lastErrorAt = null;
          meta.lastSuccessAt = new Date().toISOString();
          writeMeta(metaPath, meta);
        }

        // Error detection
        if (isErrorLine(line)) {
          meta.errorCount++;
          meta.lastError = line.slice(0, 200);
          meta.lastErrorAt = new Date().toISOString();
          writeMeta(metaPath, meta);
        }
      }

      lastProcessedLine = lines.length;
    } catch {
      // Ignore monitoring errors
    }
  }, 2000); // Check every 2 seconds

  // Wait for process to exit
  const exitCode = await new Promise<number>((resolve) => {
    proc.on("close", (code) => resolve(code ?? 1));
  });

  // Stop monitoring
  clearInterval(monitorInterval);

  // Post-process log file to update metadata
  try {
    // Cap log file size before processing
    truncateLogFile(logPath);

    const logContent = readFileSync(logPath, "utf-8");
    const lines = logContent.split("\n");

    for (const line of lines) {
      // Port detection
      if (meta.port === null) {
        const port = detectPort(line);
        if (port) {
          meta.port = port;
        }
      }

      // Success detection - reset error state when build succeeds
      if (isSuccessLine(line)) {
        meta.errorCount = 0;
        meta.lastError = null;
        meta.lastErrorAt = null;
        meta.lastSuccessAt = new Date().toISOString();
      }

      // Error detection
      if (isErrorLine(line)) {
        meta.errorCount++;
        meta.lastError = line.slice(0, 200);
        meta.lastErrorAt = new Date().toISOString();
      }
    }
  } catch {
    // Log file might not exist if command failed immediately
  }

  meta.status = "exited";
  meta.exitCode = exitCode;
  writeMeta(metaPath, meta);
  process.exit(exitCode);
}

// ============================================================================
// Package Manager Detection
// ============================================================================

function detectPackageManager(cwd: string): string {
  if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) {
    return "bun";
  }
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

function detectDevScript(cwd: string): { pm: string; script: string } | null {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const scripts = pkg.scripts || {};
    const pm = detectPackageManager(cwd);

    // Try common dev scripts in order
    for (const script of ["dev", "start", "serve"]) {
      if (scripts[script]) {
        return { pm, script };
      }
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

// ============================================================================
// siphon dev
// ============================================================================

async function runDevCommand(): Promise<void> {
  const cwd = process.cwd();
  const devInfo = detectDevScript(cwd);

  if (devInfo) {
    const { pm, script } = devInfo;
    console.error(`[siphon] Running: ${pm} run ${script}`);
    await runCommand([pm, "run", script]);
    return;
  }

  // Check for other project types
  if (existsSync(join(cwd, "Cargo.toml"))) {
    console.error("[siphon] Detected Cargo project, running: cargo run");
    await runCommand(["cargo", "run"]);
    return;
  }

  if (existsSync(join(cwd, "go.mod"))) {
    console.error("[siphon] Detected Go project, running: go run .");
    await runCommand(["go", "run", "."]);
    return;
  }

  if (existsSync(join(cwd, "manage.py"))) {
    console.error("[siphon] Detected Django project, running: python manage.py runserver");
    await runCommand(["python", "manage.py", "runserver"]);
    return;
  }

  if (existsSync(join(cwd, "pyproject.toml"))) {
    console.error(
      "[siphon] Detected Python project. Unable to determine run command.\n" +
        "Try: siphon -- python <your-script>.py"
    );
    process.exit(1);
  }

  console.error(
    "[siphon] No dev command detected.\n" +
      "Try adding a 'dev' script to package.json, or use:\n" +
      "  siphon -- <your command>"
  );
  process.exit(1);
}

// ============================================================================
// siphon list
// ============================================================================

function listSessions(): void {
  if (!existsSync(SIPHON_DIR)) {
    console.log("No siphon sessions found.");
    return;
  }

  const files = readdirSync(SIPHON_DIR).filter((f) => f.endsWith(".meta.json"));
  if (files.length === 0) {
    console.log("No siphon sessions found.");
    return;
  }

  const sessions: Array<{
    session: string;
    status: string;
    port: string;
    pid: string;
    started: string;
    errors: string;
  }> = [];

  for (const file of files) {
    const metaPath = join(SIPHON_DIR, file);
    const meta = readMeta(metaPath);
    if (!meta) continue;

    let status = meta.status;
    let exitInfo = "";

    // Check for stale sessions
    if (meta.status === "running" && !isPidAlive(meta.pid)) {
      status = "exited";
      exitInfo = "(stale)";
      // Update the meta file
      meta.status = "exited";
      meta.exitCode = null;
      writeMeta(metaPath, meta);
    } else if (meta.status === "exited" && meta.exitCode !== null) {
      exitInfo = `(${meta.exitCode})`;
    }

    const startedDate = new Date(meta.started);
    const ago = formatTimeAgo(startedDate);

    sessions.push({
      session: meta.session,
      status: `${status}${exitInfo}`,
      port: meta.port ? `port ${meta.port}` : "",
      pid: `pid ${meta.pid}`,
      started: `started ${ago}`,
      errors: `${meta.errorCount} error${meta.errorCount !== 1 ? "s" : ""}`,
    });
  }

  // Print formatted table
  for (const s of sessions) {
    const parts = [s.session.padEnd(20), s.status.padEnd(12)];
    if (s.port) parts.push(s.port.padEnd(12));
    parts.push(s.pid.padEnd(12), s.started.padEnd(16), s.errors);
    console.log(parts.join("  "));
  }
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

// ============================================================================
// siphon clean
// ============================================================================

function cleanSessions(options: { days?: number; all?: boolean }): void {
  if (!existsSync(SIPHON_DIR)) {
    console.log("Nothing to clean.");
    return;
  }

  const files = readdirSync(SIPHON_DIR);
  const maxAge = options.all ? 0 : (options.days || 7) * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let removed = 0;

  for (const file of files) {
    const filePath = join(SIPHON_DIR, file);
    const stat = statSync(filePath);
    const age = now - stat.mtimeMs;

    if (options.all || age > maxAge) {
      unlinkSync(filePath);
      removed++;
    }
  }

  console.log(`Removed ${removed} file(s).`);
}

// ============================================================================
// siphon init
// ============================================================================

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function hasProjectFiles(cwd: string): boolean {
  const projectIndicators = [
    "package.json",
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "Makefile",
    "Gemfile",
    "build.gradle",
    "pom.xml",
  ];

  for (const indicator of projectIndicators) {
    if (existsSync(join(cwd, indicator))) return true;
  }

  // Check for any source files
  const sourceExtensions = [".js", ".ts", ".py", ".rs", ".go", ".java", ".rb"];
  try {
    const files = readdirSync(cwd);
    for (const file of files) {
      if (sourceExtensions.some((ext) => file.endsWith(ext))) {
        return true;
      }
    }
  } catch {
    // Ignore errors
  }

  return false;
}

function detectAgents(cwd: string): { claudeCode: boolean; cursor: boolean } {
  return {
    claudeCode: existsSync(join(cwd, ".claude")) || existsSync(join(cwd, "CLAUDE.md")),
    cursor: existsSync(join(cwd, ".cursor")) || existsSync(join(cwd, ".cursorrules")),
  };
}

function wrapDevScript(cwd: string): boolean {
  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) return false;

  try {
    const content = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(content);

    if (!pkg.scripts) return false;

    // Find dev script
    const devScriptName = ["dev", "start", "serve"].find((s) => pkg.scripts[s]);
    if (!devScriptName) return false;

    const currentScript = pkg.scripts[devScriptName];

    // Already wrapped?
    if (currentScript.startsWith("siphon ")) {
      return false;
    }

    // Wrap it
    pkg.scripts[devScriptName] = `siphon -- ${currentScript}`;
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    return true;
  } catch {
    return false;
  }
}

function writeMcpConfig(configPath: string): boolean {
  const siphonEntry = {
    command: "siphon-mcp",
    args: [],
  };

  let config: { mcpServers?: Record<string, unknown> } = { mcpServers: {} };

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
      if (!config.mcpServers) {
        config.mcpServers = {};
      }
      // Skip if siphon already exists
      if (config.mcpServers["siphon"]) {
        return false;
      }
    } catch {
      config = { mcpServers: {} };
    }
  }

  config.mcpServers!["siphon"] = siphonEntry;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  return true;
}

const SIPHON_INSTRUCTIONS = `
## Siphon (Runtime Context)

This project uses Siphon to capture runtime output from dev processes.

**Debugging workflow:**
- After ANY code change that could affect runtime behavior, call \`check_status\` to verify it worked
- Do NOT assume a fix worked — always verify with \`check_status\`
- If the user reports something broken, call \`check_status\` BEFORE reading source code
- If \`check_status\` shows no sessions, the dev server may not be running — start it with \`siphon dev\` or the project's dev command

**Running commands:**
- Use \`siphon -- <command>\` to run any command with output capture
- All dev commands in this project are configured to run through siphon
`;

function appendInstructions(filePath: string): boolean {
  let content = "";

  if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf-8");
    // Skip if siphon already mentioned
    if (content.toLowerCase().includes("siphon")) {
      return false;
    }
  }

  writeFileSync(filePath, content + SIPHON_INSTRUCTIONS);
  return true;
}

async function initProject(): Promise<void> {
  const cwd = process.cwd();

  // Step 1: Check for empty directory
  if (!hasProjectFiles(cwd)) {
    console.log(`No project files detected in this directory.

Siphon works best when initialized in a project directory.
You can still use siphon manually:
  siphon -- <any command>

Run 'siphon init' again once your project is set up.`);
    return;
  }

  const actions: string[] = [];
  let agents = detectAgents(cwd);

  // Step 2: Detect dev command
  const devInfo = detectDevScript(cwd);

  // Step 3: Offer to wrap dev command
  if (devInfo) {
    const pkgPath = join(cwd, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    const currentScript = pkg.scripts[devInfo.script];

    if (!currentScript.startsWith("siphon ")) {
      console.log(`Detected dev command: "${currentScript}" (from package.json "${devInfo.script}" script)`);
      const answer = await prompt("Wrap it with siphon so output is automatically captured? (y/n) ");

      if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
        if (wrapDevScript(cwd)) {
          actions.push(`Wrapped "${devInfo.script}" script with siphon in package.json`);
        }
      }
    } else {
      console.log(`Dev script already wrapped with siphon.`);
    }
  }

  // Step 4: Detect or ask about agents
  if (!agents.claudeCode && !agents.cursor) {
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
        agents = { claudeCode: true, cursor: false };
        break;
      case "2":
        agents = { claudeCode: false, cursor: true };
        break;
      case "3":
        agents = { claudeCode: true, cursor: true };
        break;
      default:
        console.log("\nSkipped agent configuration. Run 'siphon init' again any time to add it.");
        if (actions.length > 0) {
          console.log("\n" + actions.map((a) => `✓ ${a}`).join("\n"));
        }
        return;
    }
  } else {
    const detected = [];
    if (agents.claudeCode) detected.push("Claude Code");
    if (agents.cursor) detected.push("Cursor");
    console.log(`Detected coding agents: ${detected.join(", ")}`);
  }

  // Step 5: Write MCP server configuration
  if (agents.claudeCode) {
    const claudeDir = join(cwd, ".claude");
    if (!existsSync(claudeDir)) {
      mkdirSync(claudeDir, { recursive: true });
    }
    if (writeMcpConfig(join(claudeDir, "mcp.json"))) {
      actions.push("Added MCP server config to .claude/mcp.json");
    }
  }

  if (agents.cursor) {
    const cursorDir = join(cwd, ".cursor");
    if (!existsSync(cursorDir)) {
      mkdirSync(cursorDir, { recursive: true });
    }
    if (writeMcpConfig(join(cursorDir, "mcp.json"))) {
      actions.push("Added MCP server config to .cursor/mcp.json");
    }
  }

  // Step 6: Write agent instructions
  if (agents.claudeCode) {
    if (appendInstructions(join(cwd, "CLAUDE.md"))) {
      actions.push("Added debugging instructions to CLAUDE.md");
    }
  }

  if (agents.cursor) {
    if (appendInstructions(join(cwd, ".cursorrules"))) {
      actions.push("Added debugging instructions to .cursorrules");
    }
  }

  // Step 7: Print summary
  if (actions.length > 0) {
    console.log("\n" + actions.map((a) => `✓ ${a}`).join("\n"));
    console.log(`\nReady! Run '${devInfo ? `${devInfo.pm} run ${devInfo.script}` : "your dev command"}' to start with siphon enabled.`);
    console.log("Tip: Run 'siphon init' again any time to update configuration.");
  } else {
    console.log("\nNothing to configure — siphon is already set up.");
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

function printUsage(): void {
  console.log(`siphon - Runtime context for coding agents

Usage:
  siphon -- <command> [args...]   Wrap a command and capture output
  siphon init                      Set up siphon for this project
  siphon dev                       Run the project's dev command via siphon
  siphon list                      Show active/recent sessions
  siphon clean [--days N] [--all]  Remove old log files

Options:
  --name <name>   Override the session name (use with --)
  --help          Show this help message

Examples:
  siphon -- npm run dev
  siphon --name my-app:frontend -- npm run dev
  siphon init
  siphon dev
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const firstArg = args[0];

  // Handle subcommands
  switch (firstArg) {
    case "init":
      await initProject();
      break;

    case "dev":
      await runDevCommand();
      break;

    case "list":
      listSessions();
      break;

    case "clean": {
      const cleanArgs = args.slice(1);
      const options: { days?: number; all?: boolean } = {};

      for (let i = 0; i < cleanArgs.length; i++) {
        if (cleanArgs[i] === "--all") {
          options.all = true;
        } else if (cleanArgs[i] === "--days" && cleanArgs[i + 1]) {
          options.days = parseInt(cleanArgs[i + 1], 10);
          i++;
        }
      }
      cleanSessions(options);
      break;
    }

    case "--": {
      // siphon -- <command>
      const cmdArgs = args.slice(1);
      if (cmdArgs.length === 0) {
        console.error("Error: No command specified after --");
        process.exit(1);
      }
      await runCommand(cmdArgs);
      break;
    }

    case "--name": {
      // siphon --name <name> -- <command>
      const nameIndex = args.indexOf("--name");
      const sessionName = args[nameIndex + 1];
      const separatorIndex = args.indexOf("--", nameIndex + 2);

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

    default:
      // Legacy invocation: treat everything as command
      await runCommand(args);
      break;
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
