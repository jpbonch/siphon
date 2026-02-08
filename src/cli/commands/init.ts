import { getAgentById, getAllAgentIds, writeMcpConfig } from "../../agents";
import { writePermissions } from "../../agents/config";

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
}
