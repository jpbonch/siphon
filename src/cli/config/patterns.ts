// Runtime signal patterns used by log analysis.

// Port extraction from typical dev server output.
export const PORT_PATTERNS = [
  /(?:localhost|127\.0\.0\.1|0\.0\.0\.0)[:\s]+(\d{4,5})/i,
  /:(\d{4,5})\b/,
  /port\s+(\d{4,5})/i,
  /listening\s+(?:on\s+)?(?:port\s+)?(\d{4,5})/i,
];

// Errors that should increase `errorCount` and update `lastError`.
export const ERROR_PATTERNS = [
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

// Positive signals that reset runtime error state.
export const SUCCESS_PATTERNS = [
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
