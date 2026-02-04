// ============================================================================
// Error Parsing Module
// ============================================================================

export interface ParsedError {
  timestamp: string | null;
  type: string;
  message: string;
  stack: string[];
  raw: string;
}

// ============================================================================
// Error Detection Patterns
// ============================================================================

// Node.js / JavaScript errors
const JS_ERROR_PATTERN = /^(\w*Error): (.+)$/;
const JS_ERROR_CODE_PATTERN = /^(\w*Error) \[(\w+)\]: (.+)$/;
const JS_STACK_PATTERN = /^\s+at\s+.+\(.+:\d+:\d+\)$/;
const JS_STACK_ALT_PATTERN = /^\s+at\s+.+\s+\(.+:\d+:\d+\)$/;
const JS_STACK_SIMPLE_PATTERN = /^\s+at\s+.+:\d+:\d+$/;
const UNCAUGHT_PATTERN = /^Uncaught (\w*Error): (.+)$/;
const UNHANDLED_REJECTION = /unhandledRejection/i;

// Node.js system errors
const SYSTEM_ERROR_PATTERN = /E(CONNREFUSED|NOTFOUND|ACCES|ADDRINUSE|PERM|NOENT)/;

// Python errors
const PYTHON_TRACEBACK_START = /^Traceback \(most recent call last\):$/;
const PYTHON_TRACEBACK_FRAME = /^\s+File ".+", line \d+/;
const PYTHON_ERROR_PATTERN = /^(\w+Error): (.+)$/;
const PYTHON_EXCEPTION_PATTERN = /^(\w+Exception): (.+)$/;

// Go errors
const GO_PANIC_PATTERN = /^panic: (.+)$/;
const GO_GOROUTINE_PATTERN = /^goroutine \d+ \[.+\]:$/;
const GO_FATAL_PATTERN = /^fatal error: (.+)$/;

// Rust errors
const RUST_PANIC_PATTERN = /^thread '.+' panicked at (.+)$/;
const RUST_COMPILER_PATTERN = /^error\[E\d+\]: (.+)$/;

// General patterns
const LOG_LEVEL_PATTERN = /\b(FATAL|CRITICAL)\b/i;
const GENERIC_ERROR_PATTERN = /^error: (.+)$/i;
const BUILD_FAILURE_PATTERNS = [
  /failed to compile/i,
  /compilation failed/i,
  /build failed/i,
];

// Timestamp patterns
const TIMESTAMP_PATTERNS = [
  /^\[(\d{2}:\d{2}:\d{2})\]/,                    // [14:32:07]
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/,     // ISO format
  /^(\d{2}:\d{2}:\d{2}\.\d{3})/,                // HH:mm:ss.SSS
  /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/, // [YYYY-MM-DD HH:mm:ss]
];

// ============================================================================
// Helper Functions
// ============================================================================

function extractTimestamp(line: string): string | null {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function isStackFrame(line: string): boolean {
  return (
    JS_STACK_PATTERN.test(line) ||
    JS_STACK_ALT_PATTERN.test(line) ||
    JS_STACK_SIMPLE_PATTERN.test(line) ||
    PYTHON_TRACEBACK_FRAME.test(line) ||
    GO_GOROUTINE_PATTERN.test(line) ||
    /^\s+.+\.go:\d+/.test(line) ||  // Go stack frames
    /^\s+at .+/.test(line)          // Generic "at" frames
  );
}

// ============================================================================
// Main Error Extraction
// ============================================================================

export function extractErrors(logContent: string): ParsedError[] {
  const lines = logContent.split("\n");
  const errors: ParsedError[] = [];
  const seen = new Map<string, number>(); // For deduplication

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const timestamp = extractTimestamp(line);
    let error: ParsedError | null = null;

    // Try JavaScript/Node.js error patterns
    let match = line.match(JS_ERROR_PATTERN);
    if (match) {
      const stack: string[] = [];
      const rawLines = [line];

      // Collect stack trace
      let j = i + 1;
      while (j < lines.length && isStackFrame(lines[j])) {
        stack.push(lines[j].trim());
        rawLines.push(lines[j]);
        j++;
      }

      error = {
        timestamp,
        type: match[1],
        message: match[2],
        stack,
        raw: rawLines.join("\n"),
      };
      i = j;
    }

    // Try JS error with code [ERR_...]
    if (!error) {
      match = line.match(JS_ERROR_CODE_PATTERN);
      if (match) {
        const stack: string[] = [];
        const rawLines = [line];

        let j = i + 1;
        while (j < lines.length && isStackFrame(lines[j])) {
          stack.push(lines[j].trim());
          rawLines.push(lines[j]);
          j++;
        }

        error = {
          timestamp,
          type: `${match[1]} [${match[2]}]`,
          message: match[3],
          stack,
          raw: rawLines.join("\n"),
        };
        i = j;
      }
    }

    // Try Uncaught error
    if (!error) {
      match = line.match(UNCAUGHT_PATTERN);
      if (match) {
        const stack: string[] = [];
        const rawLines = [line];

        let j = i + 1;
        while (j < lines.length && isStackFrame(lines[j])) {
          stack.push(lines[j].trim());
          rawLines.push(lines[j]);
          j++;
        }

        error = {
          timestamp,
          type: `Uncaught ${match[1]}`,
          message: match[2],
          stack,
          raw: rawLines.join("\n"),
        };
        i = j;
      }
    }

    // Try Python traceback
    if (!error && PYTHON_TRACEBACK_START.test(line)) {
      const rawLines = [line];
      const stack: string[] = [];
      let errorType = "Error";
      let errorMessage = "";

      let j = i + 1;
      // Collect traceback frames
      while (j < lines.length && (PYTHON_TRACEBACK_FRAME.test(lines[j]) || lines[j].trim().startsWith("File "))) {
        stack.push(lines[j].trim());
        rawLines.push(lines[j]);
        j++;
        // Skip the code line after File line
        if (j < lines.length && !PYTHON_TRACEBACK_FRAME.test(lines[j]) && !lines[j].match(/^\w+Error:|^\w+Exception:/)) {
          rawLines.push(lines[j]);
          j++;
        }
      }

      // Get the actual error line
      if (j < lines.length) {
        const errorLine = lines[j];
        rawLines.push(errorLine);
        const pyError = errorLine.match(PYTHON_ERROR_PATTERN) || errorLine.match(PYTHON_EXCEPTION_PATTERN);
        if (pyError) {
          errorType = pyError[1];
          errorMessage = pyError[2];
        } else {
          errorMessage = errorLine;
        }
        j++;
      }

      error = {
        timestamp,
        type: errorType,
        message: errorMessage,
        stack,
        raw: rawLines.join("\n"),
      };
      i = j;
    }

    // Try Go panic
    if (!error) {
      match = line.match(GO_PANIC_PATTERN);
      if (match) {
        const stack: string[] = [];
        const rawLines = [line];

        let j = i + 1;
        // Collect goroutine info and stack
        while (j < lines.length && (GO_GOROUTINE_PATTERN.test(lines[j]) || /^\s+/.test(lines[j]) || /\.go:\d+/.test(lines[j]))) {
          stack.push(lines[j].trim());
          rawLines.push(lines[j]);
          j++;
        }

        error = {
          timestamp,
          type: "panic",
          message: match[1],
          stack,
          raw: rawLines.join("\n"),
        };
        i = j;
      }
    }

    // Try Go fatal error
    if (!error) {
      match = line.match(GO_FATAL_PATTERN);
      if (match) {
        error = {
          timestamp,
          type: "fatal error",
          message: match[1],
          stack: [],
          raw: line,
        };
        i++;
      }
    }

    // Try Rust panic
    if (!error) {
      match = line.match(RUST_PANIC_PATTERN);
      if (match) {
        const stack: string[] = [];
        const rawLines = [line];

        let j = i + 1;
        while (j < lines.length && /^\s+\d+:/.test(lines[j])) {
          stack.push(lines[j].trim());
          rawLines.push(lines[j]);
          j++;
        }

        error = {
          timestamp,
          type: "panic",
          message: match[1],
          stack,
          raw: rawLines.join("\n"),
        };
        i = j;
      }
    }

    // Try Rust compiler error
    if (!error) {
      match = line.match(RUST_COMPILER_PATTERN);
      if (match) {
        const rawLines = [line];
        const stack: string[] = [];

        let j = i + 1;
        // Collect compiler output (usually indented or starts with -->)
        while (j < lines.length && (/^\s+/.test(lines[j]) || lines[j].startsWith("-->"))) {
          stack.push(lines[j].trim());
          rawLines.push(lines[j]);
          j++;
        }

        error = {
          timestamp,
          type: "error",
          message: match[1],
          stack,
          raw: rawLines.join("\n"),
        };
        i = j;
      }
    }

    // Try system errors (ECONNREFUSED, etc.)
    if (!error && SYSTEM_ERROR_PATTERN.test(line)) {
      const systemMatch = line.match(SYSTEM_ERROR_PATTERN);
      error = {
        timestamp,
        type: `E${systemMatch![1]}`,
        message: line,
        stack: [],
        raw: line,
      };
      i++;
    }

    // Try FATAL/CRITICAL log levels
    if (!error && LOG_LEVEL_PATTERN.test(line)) {
      const levelMatch = line.match(LOG_LEVEL_PATTERN);
      error = {
        timestamp,
        type: levelMatch![1].toUpperCase(),
        message: line,
        stack: [],
        raw: line,
      };
      i++;
    }

    // Try generic error prefix
    if (!error) {
      match = line.match(GENERIC_ERROR_PATTERN);
      if (match) {
        error = {
          timestamp,
          type: "error",
          message: match[1],
          stack: [],
          raw: line,
        };
        i++;
      }
    }

    // Try build failure patterns
    if (!error) {
      for (const pattern of BUILD_FAILURE_PATTERNS) {
        if (pattern.test(line)) {
          error = {
            timestamp,
            type: "build error",
            message: line,
            stack: [],
            raw: line,
          };
          i++;
          break;
        }
      }
    }

    // If we found an error, deduplicate and add
    if (error) {
      const key = `${error.type}:${error.message}`;
      const existingCount = seen.get(key) || 0;

      if (existingCount === 0) {
        errors.push(error);
      } else {
        // Update the existing error to show the latest occurrence
        const existingIndex = errors.findIndex(e => `${e.type}:${e.message}` === key);
        if (existingIndex !== -1) {
          errors[existingIndex] = error;
        }
      }
      seen.set(key, existingCount + 1);
    } else {
      i++;
    }
  }

  // Add occurrence counts to error messages for duplicates
  return errors.map(error => {
    const key = `${error.type}:${error.message}`;
    const count = seen.get(key) || 1;
    if (count > 1) {
      return {
        ...error,
        message: `${error.message} (×${count})`,
      };
    }
    return error;
  });
}

// ============================================================================
// Hint Generation
// ============================================================================

export interface SessionMeta {
  session: string;
  status: "running" | "exited";
  exitCode: number | null;
  port: number | null;
  errorCount: number;
}

export function generateHint(errors: ParsedError[], sessions: SessionMeta[]): string {
  if (errors.length === 0) {
    const allRunning = sessions.every(s => s.status === "running");
    if (allRunning && sessions.length > 0) {
      return "All processes running normally. No errors in recent output.";
    }
    return "";
  }

  const parts: string[] = [];

  // Mention the most recent error
  const latest = errors[errors.length - 1];
  parts.push(`Most recent error: ${latest.type}: ${latest.message.replace(/ \(×\d+\)$/, "")}`);

  // If we can extract a filename and line number from the stack
  if (latest.stack.length > 0) {
    const topFrame = latest.stack[0];
    const fileMatch = topFrame.match(/\((.+):(\d+):\d+\)/) ||
                      topFrame.match(/at (.+):(\d+):\d+/) ||
                      topFrame.match(/File "(.+)", line (\d+)/);
    if (fileMatch) {
      parts.push(`Consider investigating ${fileMatch[1]} around line ${fileMatch[2]}.`);
    }
  }

  // Common suggestions based on error type
  if (latest.message.includes("ECONNREFUSED") || latest.type === "ECONNREFUSED") {
    const portMatch = latest.message.match(/:(\d+)/);
    parts.push(`Check if the service on port ${portMatch?.[1] || "?"} is running.`);
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

  // Crashed sessions
  const crashed = sessions.filter(s => s.status === "exited" && s.exitCode !== 0);
  if (crashed.length > 0) {
    parts.push(`${crashed.length} process(es) have crashed and may need restart.`);
  }

  return parts.join(" ");
}
