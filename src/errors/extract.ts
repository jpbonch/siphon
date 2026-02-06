import { extractTimestamp } from "./timestamp";
import type { ParsedError } from "./types";
import { extractGenericError } from "./extractors/generic";
import { extractGoError } from "./extractors/go";
import { extractJavaScriptError } from "./extractors/javascript";
import { extractPythonError } from "./extractors/python";
import { extractRustError } from "./extractors/rust";
import type { ExtractionResult } from "./extractors/types";

// Parse mixed-language logs into normalized error records.
export function extractErrors(logContent: string): ParsedError[] {
  const lines = logContent.split("\n");
  const errors: ParsedError[] = [];
  const seen = new Map<string, number>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const timestamp = extractTimestamp(line);

    const result =
      extractJavaScriptError(lines, i, timestamp) ||
      extractPythonError(lines, i, timestamp) ||
      extractGoError(lines, i, timestamp) ||
      extractRustError(lines, i, timestamp) ||
      extractGenericError(line, i, timestamp);

    if (!result) {
      i++;
      continue;
    }

    addOrUpdateError(result, errors, seen);
    i = result.nextIndex;
  }

  return appendDuplicateCounts(errors, seen);
}

function addOrUpdateError(
  result: ExtractionResult,
  errors: ParsedError[],
  seen: Map<string, number>
): void {
  const { error } = result;
  const key = `${error.type}:${error.message}`;
  const existingCount = seen.get(key) ?? 0;

  if (existingCount === 0) {
    errors.push(error);
  } else {
    const existingIndex = errors.findIndex((candidate) => `${candidate.type}:${candidate.message}` === key);
    if (existingIndex !== -1) {
      errors[existingIndex] = error;
    }
  }

  seen.set(key, existingCount + 1);
}

function appendDuplicateCounts(errors: ParsedError[], seen: Map<string, number>): ParsedError[] {
  return errors.map((error) => {
    const key = `${error.type}:${error.message}`;
    const count = seen.get(key) ?? 1;

    if (count > 1) {
      return {
        ...error,
        message: `${error.message} (×${count})`,
      };
    }

    return error;
  });
}
