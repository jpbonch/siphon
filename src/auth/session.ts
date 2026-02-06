import { SIPHON_CLOUD_BASE_URL } from "../mcp/config/server";

const FETCH_TIMEOUT_MS = 5000;
const AUTH_SESSION_PATH = "/auth/session";
const AUTH_POLL_PATH = "/auth/poll";

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

export type PollResult = PollResultPending | PollResultComplete | PollResultRestart;

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

export function buildCloudUrl(path: string): string {
  return new URL(path, `${SIPHON_CLOUD_BASE_URL.replace(/\/+$/, "")}/`).toString();
}

export async function fetchJsonWithTimeout(url: string, init: RequestInit): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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

export async function createAuthSession(): Promise<string | null> {
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

export async function pollAuthSession(sessionId: string): Promise<PollResult> {
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
