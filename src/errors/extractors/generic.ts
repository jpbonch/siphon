import {
  BUILD_FAILURE_PATTERNS,
  GENERIC_ERROR_PATTERN,
  LOG_LEVEL_PATTERN,
  SYSTEM_ERROR_PATTERN,
} from "../patterns";
import type { ExtractionResult } from "./types";

// Parse generic/system-level error lines that do not carry multi-line stacks.
export function extractGenericError(
  line: string,
  index: number,
  timestamp: string | null
): ExtractionResult | null {
  if (SYSTEM_ERROR_PATTERN.test(line)) {
    const match = line.match(SYSTEM_ERROR_PATTERN);
    return {
      error: {
        timestamp,
        type: `E${match![1]}`,
        message: line,
        stack: [],
        raw: line,
      },
      nextIndex: index + 1,
    };
  }

  if (LOG_LEVEL_PATTERN.test(line)) {
    const match = line.match(LOG_LEVEL_PATTERN);
    return {
      error: {
        timestamp,
        type: match![1].toUpperCase(),
        message: line,
        stack: [],
        raw: line,
      },
      nextIndex: index + 1,
    };
  }

  const genericMatch = line.match(GENERIC_ERROR_PATTERN);
  if (genericMatch) {
    return {
      error: {
        timestamp,
        type: "error",
        message: genericMatch[1],
        stack: [],
        raw: line,
      },
      nextIndex: index + 1,
    };
  }

  for (const pattern of BUILD_FAILURE_PATTERNS) {
    if (pattern.test(line)) {
      return {
        error: {
          timestamp,
          type: "build error",
          message: line,
          stack: [],
          raw: line,
        },
        nextIndex: index + 1,
      };
    }
  }

  return null;
}
