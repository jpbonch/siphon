import { TIMESTAMP_PATTERNS } from "./patterns";

// Pull a readable timestamp out of a log line when possible.
export function extractTimestamp(line: string): string | null {
  for (const pattern of TIMESTAMP_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}
