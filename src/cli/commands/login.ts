import { exec } from "child_process";
import { createAuthSession, pollAuthSession } from "../../auth/session";
import { detectAgentFromEnvironment } from "../../agents/detection";
import { SIPHON_CLOUD_WEBSITE_URL } from "../../mcp/config/server";
import { saveCloudToken } from "../../mcp/production/cloud-config";

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function openBrowser(url: string): void {
  const platform = process.platform;
  const command =
    platform === "darwin"
      ? `open "${url}"`
      : platform === "win32"
        ? `start "${url}"`
        : `xdg-open "${url}"`;

  exec(command, () => {
    // Ignore errors — user can still open the URL manually
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runLoginCommand(): Promise<void> {
  console.log("Creating login session...");

  const sessionId = await createAuthSession();
  if (!sessionId) {
    console.error("Failed to create auth session. Is the Siphon Cloud API running?");
    process.exit(1);
  }

  const agentId = detectAgentFromEnvironment();
  const agentParam = agentId ? `&agent=${encodeURIComponent(agentId)}` : "";
  const loginUrl = `${SIPHON_CLOUD_WEBSITE_URL}/login?session=${encodeURIComponent(sessionId)}${agentParam}`;

  console.log(`Opening browser to sign in...`);
  console.log(`If the browser doesn't open, visit: ${loginUrl}`);
  openBrowser(loginUrl);

  console.log("Waiting for login...");

  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const result = await pollAuthSession(sessionId);

    if (result.status === "complete") {
      saveCloudToken(result.token);
      console.log("Successfully logged in!");
      return;
    }

    if (result.status === "restart") {
      console.error("Login session expired. Please try again.");
      process.exit(1);
    }
  }

  console.error("Login timed out. Please try again.");
  process.exit(1);
}
