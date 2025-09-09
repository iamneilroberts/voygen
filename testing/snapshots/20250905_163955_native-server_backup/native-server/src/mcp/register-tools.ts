import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import nativeMessagingHostInstance from '../native-messaging-host';
import { NativeMessageType, TOOL_SCHEMAS, TOOL_NAMES } from 'chrome-mcp-shared';
import { handleOrchestratorTool } from './orchestrator-tools';

export const setupTools = (server: Server) => {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_SCHEMAS }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleToolCall(request.params.name, request.params.arguments || {}),
  );
};

const handleToolCall = async (name: string, args: any): Promise<CallToolResult> => {
  try {
    // Intercept orchestrator-level tools in the native server
    if (
      name === TOOL_NAMES.ORCHESTRATOR.EXTRACT_HOTELS ||
      name === TOOL_NAMES.ORCHESTRATOR.EXTRACT_ROOM_RATES
    ) {
      return await handleOrchestratorTool(name, args);
    }
    // 发送请求到Chrome扩展并等待响应
    const response = await nativeMessagingHostInstance.sendRequestToExtensionAndWait(
      {
        name,
        args,
      },
      NativeMessageType.CALL_TOOL,
      30000, // 30秒超时
    );
    if (response.status === 'success') {
      return response.data;
    } else {
      return {
        content: [
          {
            type: 'text',
            text: `Error calling tool: ${response.error}`,
          },
        ],
        isError: true,
      };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error calling tool: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
};
