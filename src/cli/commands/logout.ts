import { clearCloudToken, clearPendingAuthSession } from "../../mcp/production/cloud-config";

export async function runLogoutCommand(): Promise<void> {
  clearCloudToken();
  clearPendingAuthSession();
  console.log("Logged out successfully.");
}
