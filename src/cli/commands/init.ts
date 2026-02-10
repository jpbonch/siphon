import { createAuthSession, pollAuthSession } from "../../auth/session";
import { getAgentById, getAllAgentIds, writeMcpConfig } from "../../agents";
import { detectAgentFromEnvironment } from "../../agents/detection";
import { writePermissions } from "../../agents/config";
import { SIPHON_CLOUD_WEBSITE_URL } from "../../mcp/config/server";
import {
  clearPendingAuthSession,
  getCloudToken,
  getPendingAuthSession,
  saveCloudToken,
  savePendingAuthSession,
} from "../../mcp/production/cloud-config";

const POLL_INTERVAL_MS = 2000;
const SESSION_RETRY_INTERVAL_MS = 3000;

function buildLoginUrl(sessionId: string): string {
  const base = `${SIPHON_CLOUD_WEBSITE_URL}/login?session=${encodeURIComponent(sessionId)}`;
  const agentId = detectAgentFromEnvironment();
  if (agentId) {
    return `${base}&agent=${encodeURIComponent(agentId)}`;
  }

  return base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureAuthSession(): Promise<string | null> {
  const pendingSession = getPendingAuthSession();
  if (pendingSession) {
    return pendingSession;
  }

  const newSession = await createAuthSession();
  if (!newSession) {
    return null;
  }

  savePendingAuthSession(newSession);
  return newSession;
}

async function waitForAuthSession(): Promise<string> {
  let didPrintRetryMessage = false;

  while (true) {
    const sessionId = await ensureAuthSession();
    if (sessionId) {
      return sessionId;
    }

    if (!didPrintRetryMessage) {
      console.log("Waiting for Siphon Cloud auth service...");
      didPrintRetryMessage = true;
    }

    await sleep(SESSION_RETRY_INTERVAL_MS);
  }
}

export async function initProject(): Promise<void> {
  const agentIds = getAllAgentIds();
  const configuredNames: string[] = [];

  for (const agentId of agentIds) {
    const agent = getAgentById(agentId);
    if (!agent) continue;
    writeMcpConfig(agent);
    writePermissions(agent);
    configuredNames.push(agent.displayName);
  }

  console.log("✓ Installed siphon CLI");
  console.log(`✓ Configured ${configuredNames.join(", ")}`);

  if (getCloudToken()) {
    console.log("✓ Already logged in to Siphon Cloud");
    return;
  }

  let sessionId = await waitForAuthSession();

  console.log("Sign in to connect Siphon Cloud:");
  console.log(buildLoginUrl(sessionId));
  console.log("Waiting for authentication...");

  while (true) {
    await sleep(POLL_INTERVAL_MS);

    const result = await pollAuthSession(sessionId);
    if (result.status === "complete") {
      saveCloudToken(result.token);
      clearPendingAuthSession();
      console.log("Authenticated successfully.");
      return;
    }

    if (result.status === "restart") {
      clearPendingAuthSession();
      console.log("Authentication session expired. Generating a new login link...");
      sessionId = await waitForAuthSession();
      console.log("Sign in to connect Siphon Cloud:");
      console.log(buildLoginUrl(sessionId));
    }
  }
}
