import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./config/server";
import { registerCheckStatusTool } from "./tools/check-status";
import { registerGetOutputTool } from "./tools/get-output";

// Build and configure MCP server instance.
export function createSiphonMcpServer(): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  // Tool registration is split into dedicated modules for maintainability.
  registerCheckStatusTool(server);
  registerGetOutputTool(server);

  return server;
}
