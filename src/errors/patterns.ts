// Keep detection patterns centralized so they can be tuned without touching parser logic.

// Node.js / JavaScript errors.
export const JS_ERROR_PATTERN = /^(\w*Error): (.+)$/;
export const JS_ERROR_CODE_PATTERN = /^(\w*Error) \[(\w+)\]: (.+)$/;
export const JS_STACK_PATTERN = /^\s+at\s+.+\(.+:\d+:\d+\)$/;
export const JS_STACK_ALT_PATTERN = /^\s+at\s+.+\s+\(.+:\d+:\d+\)$/;
export const JS_STACK_SIMPLE_PATTERN = /^\s+at\s+.+:\d+:\d+$/;
export const UNCAUGHT_PATTERN = /^Uncaught (\w*Error): (.+)$/;

// Node.js system errors.
export const SYSTEM_ERROR_PATTERN = /E(CONNREFUSED|NOTFOUND|ACCES|ADDRINUSE|PERM|NOENT)/;

// Python errors.
export const PYTHON_TRACEBACK_START = /^Traceback \(most recent call last\):$/;
export const PYTHON_TRACEBACK_FRAME = /^\s+File ".+", line \d+/;
export const PYTHON_ERROR_PATTERN = /^(\w+Error): (.+)$/;
export const PYTHON_EXCEPTION_PATTERN = /^(\w+Exception): (.+)$/;

// Go errors.
export const GO_PANIC_PATTERN = /^panic: (.+)$/;
export const GO_GOROUTINE_PATTERN = /^goroutine \d+ \[.+\]:$/;
export const GO_FATAL_PATTERN = /^fatal error: (.+)$/;

// Rust errors.
export const RUST_PANIC_PATTERN = /^thread '.+' panicked at (.+)$/;
export const RUST_COMPILER_PATTERN = /^error\[E\d+\]: (.+)$/;

// General patterns.
export const LOG_LEVEL_PATTERN = /\b(FATAL|CRITICAL)\b/i;
export const GENERIC_ERROR_PATTERN = /^error: (.+)$/i;
export const BUILD_FAILURE_PATTERNS = [
  /failed to compile/i,
  /compilation failed/i,
  /build failed/i,
];

// Supported timestamp formats found in logs.
export const TIMESTAMP_PATTERNS = [
  /^\[(\d{2}:\d{2}:\d{2})\]/,
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/,
  /^(\d{2}:\d{2}:\d{2}\.\d{3})/,
  /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]/,
];
