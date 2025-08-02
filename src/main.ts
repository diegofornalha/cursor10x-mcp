import {
  CallToolRequest,
  CallToolResult,
  ContentType,
  ListToolsResult,
} from "./pdk";
import * as tursoMCP from "./turso-mcp";

/**
 * Called when the tool is invoked.
 * Routes to the appropriate Turso MCP implementation.
 *
 * @param {CallToolRequest} input - The incoming tool request from the LLM
 * @returns {CallToolResult} The servlet's response to the given tool call
 */
export async function callImpl(input: CallToolRequest): Promise<CallToolResult> {
  return await tursoMCP.callImpl(input);
}

/**
 * Called by mcpx to understand how and why to use this tool.
 * Returns all available Turso database tools.
 *
 * @returns {ListToolsResult} The tools' descriptions, supporting multiple tools from a single servlet.
 */
export function describeImpl(): ListToolsResult {
  return tursoMCP.describeImpl();
}
