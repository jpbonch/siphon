import {
  GO_GOROUTINE_PATTERN,
  JS_STACK_ALT_PATTERN,
  JS_STACK_PATTERN,
  JS_STACK_SIMPLE_PATTERN,
  PYTHON_TRACEBACK_FRAME,
} from "./patterns";

// Detect whether a line belongs to a stack trace block.
export function isStackFrame(line: string): boolean {
  return (
    JS_STACK_PATTERN.test(line) ||
    JS_STACK_ALT_PATTERN.test(line) ||
    JS_STACK_SIMPLE_PATTERN.test(line) ||
    PYTHON_TRACEBACK_FRAME.test(line) ||
    GO_GOROUTINE_PATTERN.test(line) ||
    /^\s+.+\.go:\d+/.test(line) ||
    /^\s+at .+/.test(line)
  );
}
