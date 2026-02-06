// Parsed runtime error shape returned to MCP tool handlers.
export interface ParsedError {
  timestamp: string | null;
  type: string;
  message: string;
  stack: string[];
  raw: string;
}

// Lightweight session metadata needed for hint generation.
export interface SessionMeta {
  session: string;
  status: "running" | "exited";
  exitCode: number | null;
  port: number | null;
  errorCount: number;
}
