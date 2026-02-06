import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

interface SiphonAuthFile {
  apiKey: string;
  updatedAt: string;
}

const SIPHON_AUTH_FILE_PATH = join(homedir(), ".siphon", "auth.json");

export function getSiphonAuthFilePath(): string {
  return SIPHON_AUTH_FILE_PATH;
}

export function saveApiKey(apiKey: string): void {
  const normalizedApiKey = apiKey.trim();

  if (!normalizedApiKey) {
    throw new Error("API key cannot be empty.");
  }

  const parentDir = dirname(SIPHON_AUTH_FILE_PATH);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }

  const payload: SiphonAuthFile = {
    apiKey: normalizedApiKey,
    updatedAt: new Date().toISOString(),
  };

  writeFileSync(SIPHON_AUTH_FILE_PATH, JSON.stringify(payload, null, 2));
}

export function getApiKey(): string | null {
  if (!existsSync(SIPHON_AUTH_FILE_PATH)) {
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(SIPHON_AUTH_FILE_PATH, "utf-8")) as Partial<SiphonAuthFile>;
    const apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
    return apiKey.length > 0 ? apiKey : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getApiKey() !== null;
}
