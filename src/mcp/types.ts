// Full metadata persisted by CLI and consumed by MCP tools.
export interface FullSessionMeta {
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
  lastSuccessAt?: string | null;
}

// In-memory session record used by tool handlers.
export interface SessionRecord {
  meta: FullSessionMeta;
  metaPath: string;
  logPath: string;
}

// Process detected outside siphon capture.
export interface UncapturedProcess {
  command: string;
  pid: number;
  port: number;
  fullArgs?: string;
}
