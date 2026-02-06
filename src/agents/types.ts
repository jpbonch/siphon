// Shared contract for all supported coding agents.
export interface Agent {
  id: string;
  displayName: string;

  // Marker files/directories used to detect usage in a project.
  projectMarkers: string[];

  // Optional environment variable that can indicate the active agent.
  envVariable?: string;

  // Global MCP config file for the agent.
  globalConfigPath: string;

  // Project-local instructions file for this agent.
  instructionsFile: string;
}
