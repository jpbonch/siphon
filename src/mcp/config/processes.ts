// Commands considered likely dev servers when listening on local ports.
export const DEV_PROCESS_NAMES = [
  "node",
  "python",
  "python3",
  "ruby",
  "cargo",
  "go",
  "java",
  "bun",
  "deno",
  "uvicorn",
  "gunicorn",
  "next-server",
  "vite",
];

// Port band used to detect likely dev servers.
export const DEV_PORT_MIN = 3000;
export const DEV_PORT_MAX = 9999;

// Platform-specific command to enumerate listening sockets.
export const LISTENING_PROCESS_COMMAND =
  process.platform === "darwin"
    ? "lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null"
    : "ss -tlnp 2>/dev/null";
