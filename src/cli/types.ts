// Session metadata persisted alongside each captured log file.
export interface SessionMeta {
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

// `siphon init` command options.
export interface InitOptions {
  yes?: boolean;
  agent?: string;
}

// `siphon clean` command options.
export interface CleanOptions {
  days?: number;
  all?: boolean;
}

// Result of package.json script detection.
export interface DevScriptInfo {
  pm: string;
  script: string;
}
