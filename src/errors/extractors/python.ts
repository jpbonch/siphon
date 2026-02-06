import {
  PYTHON_ERROR_PATTERN,
  PYTHON_EXCEPTION_PATTERN,
  PYTHON_TRACEBACK_FRAME,
  PYTHON_TRACEBACK_START,
} from "../patterns";
import type { ExtractionResult } from "./types";

// Parse Python traceback blocks into one normalized error record.
export function extractPythonError(
  lines: string[],
  index: number,
  timestamp: string | null
): ExtractionResult | null {
  const line = lines[index];
  if (!PYTHON_TRACEBACK_START.test(line)) {
    return null;
  }

  const rawLines = [line];
  const stack: string[] = [];
  let errorType = "Error";
  let errorMessage = "";

  let j = index + 1;

  while (j < lines.length && (PYTHON_TRACEBACK_FRAME.test(lines[j]) || lines[j].trim().startsWith("File "))) {
    stack.push(lines[j].trim());
    rawLines.push(lines[j]);
    j++;

    if (
      j < lines.length &&
      !PYTHON_TRACEBACK_FRAME.test(lines[j]) &&
      !lines[j].match(/^\w+Error:|^\w+Exception:/)
    ) {
      rawLines.push(lines[j]);
      j++;
    }
  }

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

  return {
    error: {
      timestamp,
      type: errorType,
      message: errorMessage,
      stack,
      raw: rawLines.join("\n"),
    },
    nextIndex: j,
  };
}
