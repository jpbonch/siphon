import { SIPHON_DIR } from "../config/paths";

// Resolve metadata/log file paths for a session name.
export function getSessionPaths(sessionName: string): { logPath: string; metaPath: string } {
  const safeName = process.platform === "win32" ? sessionName.replace(/:/g, "--") : sessionName;

  return {
    logPath: `${SIPHON_DIR}/${safeName}.log`,
    metaPath: `${SIPHON_DIR}/${safeName}.meta.json`,
  };
}
