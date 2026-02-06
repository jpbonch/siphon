import { homedir } from "os";
import { clearApiKey, getSiphonAuthFilePath } from "../../auth/credentials";
import { clearCloudToken } from "../../mcp/production/cloud-config";

// Remove locally stored API key and cloud token used for production context auth.
export async function runLogoutCommand(): Promise<void> {
  clearCloudToken();
  const removed = clearApiKey();

  if (removed) {
    const authPath = getSiphonAuthFilePath().replace(homedir(), "~");
    console.log(`Removed API key from ${authPath}`);
  }

  console.log("Logged out successfully.");
}
