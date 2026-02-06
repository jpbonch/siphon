import {
  RUST_COMPILER_PATTERN,
  RUST_PANIC_PATTERN,
} from "../patterns";
import type { ExtractionResult } from "./types";

// Parse Rust panic and compiler diagnostics.
export function extractRustError(
  lines: string[],
  index: number,
  timestamp: string | null
): ExtractionResult | null {
  const line = lines[index];

  let match = line.match(RUST_PANIC_PATTERN);
  if (match) {
    const stack: string[] = [];
    const rawLines = [line];

    let j = index + 1;
    while (j < lines.length && /^\s+\d+:/.test(lines[j])) {
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

  match = line.match(RUST_COMPILER_PATTERN);
  if (match) {
    const rawLines = [line];
    const stack: string[] = [];

    let j = index + 1;
    while (j < lines.length && (/^\s+/.test(lines[j]) || lines[j].startsWith("-->"))) {
      stack.push(lines[j].trim());
      rawLines.push(lines[j]);
      j++;
    }

    return {
      error: {
        timestamp,
        type: "error",
        message: match[1],
        stack,
        raw: rawLines.join("\n"),
      },
      nextIndex: j,
    };
  }

  return null;
}
