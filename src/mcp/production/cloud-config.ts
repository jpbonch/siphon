import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

interface SiphonCloudConfig {
  token?: string | null;
  pendingAuthSession?: string | null;
}

const SIPHON_DIR = join(homedir(), ".siphon");
const SIPHON_CONFIG_PATH = join(SIPHON_DIR, "config.json");

function ensureSiphonDir(): void {
  if (!existsSync(SIPHON_DIR)) {
    mkdirSync(SIPHON_DIR, { recursive: true });
  }
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readCloudConfig(): SiphonCloudConfig {
  if (!existsSync(SIPHON_CONFIG_PATH)) {
    return {};
  }

  try {
    const parsed = JSON.parse(readFileSync(SIPHON_CONFIG_PATH, "utf-8")) as SiphonCloudConfig;
    return {
      token: normalizeString(parsed.token),
      pendingAuthSession: normalizeString(parsed.pendingAuthSession),
    };
  } catch {
    return {};
  }
}

function writeCloudConfig(nextConfig: SiphonCloudConfig): void {
  ensureSiphonDir();
  writeFileSync(SIPHON_CONFIG_PATH, JSON.stringify(nextConfig, null, 2));
}

export function getCloudToken(): string | null {
  return readCloudConfig().token ?? null;
}

export function getPendingAuthSession(): string | null {
  return readCloudConfig().pendingAuthSession ?? null;
}

export function saveCloudToken(token: string): void {
  const normalizedToken = normalizeString(token);
  if (!normalizedToken) {
    return;
  }

  const current = readCloudConfig();
  writeCloudConfig({
    ...current,
    token: normalizedToken,
    pendingAuthSession: null,
  });
}

export function clearCloudToken(): void {
  const current = readCloudConfig();
  writeCloudConfig({
    ...current,
    token: null,
  });
}

export function savePendingAuthSession(sessionId: string): void {
  const normalizedSessionId = normalizeString(sessionId);
  if (!normalizedSessionId) {
    return;
  }

  const current = readCloudConfig();
  writeCloudConfig({
    ...current,
    pendingAuthSession: normalizedSessionId,
  });
}

export function clearPendingAuthSession(): void {
  const current = readCloudConfig();
  writeCloudConfig({
    ...current,
    pendingAuthSession: null,
  });
}
