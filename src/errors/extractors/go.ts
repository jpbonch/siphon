import {
  GO_FATAL_PATTERN,
  GO_GOROUTINE_PATTERN,
  GO_PANIC_PATTERN,
} from "../patterns";
import type { ExtractionResult } from "./types";

// Parse Go panic/fatal output.
export function extractGoError(
  lines: string[],
  index: number,
  timestamp: string | null
): ExtractionResult | null {
  const line = lines[index];

  let match = line.match(GO_PANIC_PATTERN);
  if (match) {
    const stack: string[] = [];
    const rawLines = [line];

    let j = index + 1;
    while (
      j < lines.length &&
      (GO_GOROUTINE_PATTERN.test(lines[j]) || /^\s+/.test(lines[j]) || /\.go:\d+/.test(lines[j]))
    ) {
      stack.push(lines[j].trim());
      rawLines.push(lines[j]);
      j++;
    }

    return {
      error: {
        timestamp,
        type: "panic",
        message: match[1],
        stack,
        raw: rawLines.join("\n"),
      },
      nextIndex: j,
    };
  }

  match = line.match(GO_FATAL_PATTERN);
  if (match) {
    return {
      error: {
        timestamp,
        type: "fatal error",
        message: match[1],
        stack: [],
        raw: line,
      },
      nextIndex: index + 1,
    };
  }

  return null;
}
