import { getApiKey } from "../../auth/credentials";
import { SIPHON_CLOUD_BASE_URL } from "../config/server";
import {
  clearCloudToken,
  clearPendingAuthSession,
  getCloudToken,
  getPendingAuthSession,
  saveCloudToken,
  savePendingAuthSession,
} from "./cloud-config";

const PRODUCTION_FETCH_TIMEOUT_MS = 5000;
const PRODUCTION_ERROR_LIMIT = 5;
const MAX_RAW_RESPONSE_CHARS = 320;
const AUTH_SESSION_PATH = "/v1/auth/session";
const AUTH_POLL_PATH = "/v1/auth/poll";
const CONTEXT_PATH = "/context";

interface ProductionService {
  name: string;
  status: string;
  errorCount: number | null;
  lastError: string | null;
}

interface ProductionError {
  service: string | null;
  message: string;
  timestamp: string | null;
}

interface PollResultPending {
  status: "pending";
}

interface PollResultComplete {
  status: "complete";
  token: string;
}

interface PollResultRestart {
  status: "restart";
}

type PollResult = PollResultPending | PollResultComplete | PollResultRestart;

interface TokenResolution {
  token: string | null;
  source: "cloud-token" | "legacy-api-key" | null;
  sessionId: string | null;
}

export interface ProductionContextInput {
  errors: Array<{
    type: string;
    message: string;
    timestamp?: string | null;
    stack?: string[];
  }>;
  sessions: Array<{
    session: string;
    status: string;
    exitCode: number | null;
    port: number | null;
    errorCount: number;
  }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function getString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

function getNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function safeValueSnippet(value: unknown, maxLength: number): string {
  if (typeof value === "string") {
    return truncate(value, maxLength);
  }

  try {
    return truncate(JSON.stringify(value), maxLength);
  } catch {
    return "[unserializable]";
  }
}

function buildCloudUrl(path: string): string {
  return new URL(path, `${SIPHON_CLOUD_BASE_URL.replace(/\/+$/, "")}/`).toString();
}

function buildAuthLink(sessionId: string): string {
  return buildCloudUrl(`/auth/${encodeURIComponent(sessionId)}`);
}

function buildAuthPromptLines(sessionId: string): string[] {
  return [
    "=== Production services ===",
    "No production context available.",
    "",
    "To connect Sentry, Datadog, and team features:",
    `→ Click to authenticate: ${buildAuthLink(sessionId)}`,
    "",
    "After clicking, run check_status again to verify connection.",
  ];
}

async function fetchJsonWithTimeout(url: string, init: RequestInit): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PRODUCTION_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    const rawBody = await response.text();
    let body: unknown = null;

    if (rawBody.trim()) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }

    return { response, body };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function createAuthSession(): Promise<string | null> {
  const url = buildCloudUrl(AUTH_SESSION_PATH);
  const { response, body } = await fetchJsonWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return null;
  }

  const bodyRecord = asRecord(body);
  if (!bodyRecord) {
    return null;
  }

  return getString(bodyRecord, ["sessionId", "session_id"]);
}

async function pollAuthSession(sessionId: string): Promise<PollResult> {
  const url = buildCloudUrl(`${AUTH_POLL_PATH}/${encodeURIComponent(sessionId)}`);
  const { response, body } = await fetchJsonWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (response.status === 202) {
    return { status: "pending" };
  }

  if (response.status === 404 || response.status === 410) {
    return { status: "restart" };
  }

  if (!response.ok) {
    return { status: "pending" };
  }

  const bodyRecord = asRecord(body);
  if (!bodyRecord) {
    return { status: "pending" };
  }

  const token = getString(bodyRecord, ["token", "accessToken", "access_token"]);
  if (!token) {
    return { status: "pending" };
  }

  return {
    status: "complete",
    token,
  };
}

async function resolveToken(): Promise<TokenResolution> {
  const cloudToken = getCloudToken();
  if (cloudToken) {
    return {
      token: cloudToken,
      source: "cloud-token",
      sessionId: null,
    };
  }

  const pendingSession = getPendingAuthSession();
  if (pendingSession) {
    const pollResult = await pollAuthSession(pendingSession);

    if (pollResult.status === "complete") {
      saveCloudToken(pollResult.token);
      clearPendingAuthSession();
      return {
        token: pollResult.token,
        source: "cloud-token",
        sessionId: null,
      };
    }

    if (pollResult.status === "pending") {
      return {
        token: null,
        source: null,
        sessionId: pendingSession,
      };
    }

    clearPendingAuthSession();
  }

  const legacyApiKey = getApiKey();
  if (legacyApiKey) {
    return {
      token: legacyApiKey,
      source: "legacy-api-key",
      sessionId: null,
    };
  }

  const newSessionId = await createAuthSession();
  if (!newSessionId) {
    return {
      token: null,
      source: null,
      sessionId: null,
    };
  }

  savePendingAuthSession(newSessionId);
  return {
    token: null,
    source: null,
    sessionId: newSessionId,
  };
}

function extractServiceEntries(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = asRecord(payload);
  if (!record) {
    return [];
  }

  if (Array.isArray(record.services)) {
    return record.services;
  }

  if (Array.isArray(record.processes)) {
    return record.processes;
  }

  if ("status" in record || "state" in record || "health" in record) {
    return [record];
  }

  return [];
}

function toProductionService(entry: unknown): ProductionService | null {
  const record = asRecord(entry);
  if (!record) {
    return null;
  }

  const name = getString(record, ["name", "service", "id", "process"]) ?? "unnamed-service";
  const status = getString(record, ["status", "state", "health"]) ?? "unknown";
  const explicitErrorCount = getNumber(record, ["errorCount"]);
  const implicitErrorCount = Array.isArray(record.errors) ? record.errors.length : null;
  const errorCount = explicitErrorCount ?? implicitErrorCount;
  const lastError = getString(record, ["lastError", "error", "message"]);

  return {
    name,
    status,
    errorCount,
    lastError,
  };
}

function toProductionError(entry: unknown, fallbackService: string | null = null): ProductionError | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim();
    if (!trimmed) {
      return null;
    }

    return {
      service: fallbackService,
      message: trimmed,
      timestamp: null,
    };
  }

  const record = asRecord(entry);
  if (!record) {
    return null;
  }

  const message = getString(record, ["message", "error", "detail", "lastError"]);
  if (!message) {
    return null;
  }

  return {
    service: getString(record, ["service", "name", "process"]) ?? fallbackService,
    message,
    timestamp: getString(record, ["timestamp", "time", "occurredAt", "at"]),
  };
}

function extractTopLevelErrors(payload: unknown): ProductionError[] {
  const record = asRecord(payload);
  if (!record || !Array.isArray(record.errors)) {
    return [];
  }

  return record.errors
    .map((entry) => toProductionError(entry))
    .filter((entry): entry is ProductionError => entry !== null);
}

function extractServiceErrors(serviceEntries: unknown[]): ProductionError[] {
  const errors: ProductionError[] = [];

  for (const entry of serviceEntries) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }

    const serviceName = getString(record, ["name", "service", "id", "process"]) ?? null;
    if (Array.isArray(record.errors)) {
      for (const serviceError of record.errors) {
        const parsedError = toProductionError(serviceError, serviceName);
        if (parsedError) {
          errors.push(parsedError);
        }
      }
    }

    const lastError = getString(record, ["lastError"]);
    if (lastError) {
      errors.push({
        service: serviceName,
        message: lastError,
        timestamp: null,
      });
    }
  }

  return errors;
}

function dedupeErrors(errors: ProductionError[]): ProductionError[] {
  const deduped: ProductionError[] = [];
  const seen = new Set<string>();

  for (const error of errors) {
    const key = `${error.service ?? ""}|${error.message}|${error.timestamp ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(error);
  }

  return deduped;
}

function formatErrorCount(errorCount: number | null): string {
  if (errorCount === null) {
    return "";
  }

  return `, ${errorCount} error${errorCount !== 1 ? "s" : ""}`;
}

function formatProductionPayload(payload: unknown, sourceUrl: string): string[] {
  const lines: string[] = ["=== Production services ==="];

  if (payload === null || payload === undefined || payload === "") {
    lines.push("No production data returned by API.");
    lines.push(`Source: ${sourceUrl}`);
    return lines;
  }

  if (typeof payload === "string") {
    lines.push(`Raw response: ${safeValueSnippet(payload, MAX_RAW_RESPONSE_CHARS)}`);
    lines.push(`Source: ${sourceUrl}`);
    return lines;
  }

  const serviceEntries = extractServiceEntries(payload);
  const services = serviceEntries
    .map(toProductionService)
    .filter((entry): entry is ProductionService => entry !== null);
  const errors = dedupeErrors([...extractTopLevelErrors(payload), ...extractServiceErrors(serviceEntries)]);

  if (services.length === 0 && errors.length === 0) {
    lines.push(`Raw payload: ${safeValueSnippet(payload, MAX_RAW_RESPONSE_CHARS)}`);
    lines.push(`Source: ${sourceUrl}`);
    return lines;
  }

  if (services.length > 0) {
    lines.push("Services:");
    for (const service of services) {
      lines.push(
        `  ${service.name} — ${service.status}${formatErrorCount(service.errorCount)}${
          service.lastError ? ` (last error: ${service.lastError})` : ""
        }`
      );
    }
  }

  if (errors.length > 0) {
    lines.push("Recent production errors:");
    for (const error of errors.slice(0, PRODUCTION_ERROR_LIMIT)) {
      const servicePrefix = error.service ? `${error.service}: ` : "";
      const timestampPrefix = error.timestamp ? `[${error.timestamp}] ` : "";
      lines.push(`  ${timestampPrefix}${servicePrefix}${error.message}`);
    }

    if (errors.length > PRODUCTION_ERROR_LIMIT) {
      lines.push(`  ... and ${errors.length - PRODUCTION_ERROR_LIMIT} more`);
    }
  }

  const payloadRecord = asRecord(payload);
  const summary = payloadRecord ? getString(payloadRecord, ["summary"]) : null;
  if (summary) {
    lines.push(`Summary: ${summary}`);
  }

  lines.push(`Source: ${sourceUrl}`);
  return lines;
}

function buildFailureLines(message: string): string[] {
  return ["=== Production services ===", message];
}

async function ensurePendingAuthSession(): Promise<string | null> {
  const existing = getPendingAuthSession();
  if (existing) {
    return existing;
  }

  const newSessionId = await createAuthSession();
  if (!newSessionId) {
    return null;
  }

  savePendingAuthSession(newSessionId);
  return newSessionId;
}

export async function getProductionContextLines(localContext: ProductionContextInput): Promise<string[]> {
  try {
    void localContext;

    const resolved = await resolveToken();
    if (!resolved.token) {
      if (resolved.sessionId) {
        return buildAuthPromptLines(resolved.sessionId);
      }

      return buildFailureLines("Unable to create authentication session right now. Try check_status again.");
    }

    const contextUrl = buildCloudUrl(CONTEXT_PATH);
    const { response, body } = await fetchJsonWithTimeout(contextUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${resolved.token}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      if (resolved.source === "cloud-token") {
        clearCloudToken();
      }

      const authSessionId = await ensurePendingAuthSession();
      if (authSessionId) {
        return buildAuthPromptLines(authSessionId);
      }

      return buildFailureLines("Production authentication expired. Could not create a new auth session.");
    }

    if (!response.ok) {
      const detail = body ? ` Details: ${safeValueSnippet(body, MAX_RAW_RESPONSE_CHARS)}` : "";
      return buildFailureLines(`Production API request failed: ${response.status} ${response.statusText}.${detail}`);
    }

    return formatProductionPayload(body, contextUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return buildFailureLines(`Production API request failed: ${errorMessage}`);
  }
}
