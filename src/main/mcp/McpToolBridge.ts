import { Type } from '@sinclair/typebox';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { ToolDefinition } from '@earendil-works/pi-coding-agent';
import { McpServer } from './McpServer';

interface McpToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Build Pi SDK tool definitions from an MCP server's tool list.
 * Each MCP tool is wrapped as a custom tool that forwards calls via JSON-RPC.
 *
 * Tool names are prefixed with "mcp__<serverId>__" to avoid collisions.
 */
export function buildMcpTools(
  server: McpServer,
  serverId: string,
  tools: McpToolInfo[]
): ToolDefinition[] {
  return tools.map((tool) => {
    const toolName = `mcp__${serverId}__${tool.name}`;

    return defineTool({
      name: toolName,
      label: `[MCP: ${server.config.name}] ${tool.name}`,
      description: tool.description || `MCP tool from ${server.config.name}`,
      parameters: Type.Object({}, { additionalProperties: true }),
      async execute(toolCallId, params, signal) {
        let contentText: string;
        let isError = false;
        let rawResult: unknown = null;

        try {
          rawResult = await server.callTool(tool.name, params as Record<string, unknown>, signal);
          contentText = formatMcpResult(rawResult);
        } catch (err) {
          isError = true;
          contentText = `Error: ${err instanceof Error ? err.message : String(err)}`;
        }

        return {
          content: [{ type: 'text', text: contentText }],
          details: {
            server: server.config.name,
            tool: tool.name,
            isError,
            rawResult
          }
        };
      }
    }) as unknown as ToolDefinition;
  });
}

function formatMcpResult(result: unknown): string {
  if (result == null) return '';

  if (typeof result === 'object' && result !== null) {
    const r = result as { content?: unknown[]; isError?: boolean; error?: unknown };

    if (r.isError && r.error) {
      return `Error: ${JSON.stringify(r.error)}`;
    }

    if (Array.isArray(r.content)) {
      return r.content
        .map((item: any) => {
          if (item.type === 'text') return item.text || '';
          if (item.type === 'image') return '[Image content]';
          return JSON.stringify(item);
        })
        .join('\n');
    }
  }

  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}
