import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createSiphonMcpServer } from "./server";

// Start MCP server on stdio transport.
export async function runMcpServer(): Promise<void> {
  const server = createSiphonMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
