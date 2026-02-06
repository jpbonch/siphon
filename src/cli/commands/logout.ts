import { homedir } from "os";
import { clearApiKey, getSiphonAuthFilePath } from "../../auth/credentials";

// Remove locally stored API key used for production context auth.
export async function runLogoutCommand(): Promise<void> {
  const removed = clearApiKey();

  if (removed) {
    const authPath = getSiphonAuthFilePath().replace(homedir(), "~");
    console.log(`Removed API key from ${authPath}`);
    return;
  }

  console.log("No API key found. Already logged out.");
}
