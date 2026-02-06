import { existsSync, mkdirSync } from "fs";
import { homedir } from "os";

// Base location for runtime artifacts captured by siphon.
export const SIPHON_DIR = `${homedir()}/.siphon`;

// Ensure the runtime folder exists before any reads/writes.
export function ensureSiphonDir(): void {
  if (!existsSync(SIPHON_DIR)) {
    mkdirSync(SIPHON_DIR, { recursive: true });
  }
}
