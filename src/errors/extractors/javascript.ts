import {
  JS_ERROR_CODE_PATTERN,
  JS_ERROR_PATTERN,
  UNCAUGHT_PATTERN,
} from "../patterns";
import { isStackFrame } from "../stack";
import type { ExtractionResult } from "./types";

// Parse JavaScript/Node errors and capture following stack frames.
export function extractJavaScriptError(
  lines: string[],
  index: number,
  timestamp: string | null
): ExtractionResult | null {
  const line = lines[index];

  let match = line.match(JS_ERROR_PATTERN);
  if (match) {
    const { stack, rawLines, nextIndex } = collectStack(lines, index);

    return {
      error: {
        timestamp,
        type: match[1],
        message: match[2],
        stack,
        raw: rawLines.join("\n"),
      },
      nextIndex,
    };
  }

  match = line.match(JS_ERROR_CODE_PATTERN);
  if (match) {
    const { stack, rawLines, nextIndex } = collectStack(lines, index);

    return {
      error: {
        timestamp,
        type: `${match[1]} [${match[2]}]`,
        message: match[3],
        stack,
        raw: rawLines.join("\n"),
      },
      nextIndex,
    };
  }

  match = line.match(UNCAUGHT_PATTERN);
  if (match) {
    const { stack, rawLines, nextIndex } = collectStack(lines, index);

    return {
      error: {
        timestamp,
        type: `Uncaught ${match[1]}`,
        message: match[2],
        stack,
        raw: rawLines.join("\n"),
      },
      nextIndex,
    };
  }

  return null;
}

function collectStack(lines: string[], index: number): {
  stack: string[];
  rawLines: string[];
  nextIndex: number;
} {
  const stack: string[] = [];
  const rawLines = [lines[index]];

  let j = index + 1;
  while (j < lines.length && isStackFrame(lines[j])) {
    stack.push(lines[j].trim());
    rawLines.push(lines[j]);
    j++;
  }

  return { stack, rawLines, nextIndex: j };
}
