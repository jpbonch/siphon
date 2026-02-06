import { homedir } from "os";
import { getSiphonAuthFilePath, saveApiKey } from "../../auth/credentials";
import { prompt } from "../utils/prompt";

// Save a Siphon API key locally so MCP tools can request production context.
export async function runLoginCommand(): Promise<void> {
  if (!(process.stdin.isTTY ?? false)) {
    console.error("siphon login requires an interactive terminal.");
    process.exit(1);
  }

  const apiKey = await prompt("Paste your Siphon API key: ");
  if (!apiKey) {
    console.error("No API key provided. Login cancelled.");
    process.exit(1);
  }

  saveApiKey(apiKey);

  const authPath = getSiphonAuthFilePath().replace(homedir(), "~");
  console.log(`Saved API key to ${authPath}`);
}
