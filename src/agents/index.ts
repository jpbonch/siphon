export type { Agent } from "./types";
export { agents } from "./registry";
export { detectAgentsInProject, detectAgentFromEnvironment } from "./detection";
export { writeMcpConfig } from "./config";
export { appendInstructions } from "./instructions";
export { getAgentById, getAllAgentIds } from "./query";
