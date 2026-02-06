import type { ParsedError } from "../types";

// Shared return shape used by all language-specific extractors.
export interface ExtractionResult {
  error: ParsedError;
  nextIndex: number;
}
