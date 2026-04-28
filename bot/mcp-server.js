import express from 'express';
import { randomUUID } from 'crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerStatusTools } from './tools/status.js';
import { registerChatTools } from './tools/chat.js';
import { registerNavigationTools } from './tools/navigation.js';
import { registerWorldTools } from './tools/world.js';
import { registerInventoryTools } from './tools/inventory.js';

const MCP_PORT = 8888;

function createMcpServer(state) {
  const server = new McpServer({ name: 'minecraft', version: '1.0.0' });
  registerStatusTools(server, state);
  registerChatTools(server, state);
  registerNavigationTools(server, state);
  registerWorldTools(server, state);
  registerInventoryTools(server, state);
  return server;
}

export function startMcpServer(state) {
  const app = express();
  app.use(express.json());

  // sessionId → { transport, mcpServer }
  const sessions = new Map();

  app.post('/mcp', async (req, res) => {
    try {
      const existingId = req.headers['mcp-session-id'];

      if (existingId && sessions.has(existingId)) {
        // Existing session — route to its transport
        await sessions.get(existingId).transport.handleRequest(req, res, req.body);
        return;
      }

      // New session
      const sessionId = randomUUID();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
      });

      const mcpServer = createMcpServer(state);
      await mcpServer.connect(transport);

      sessions.set(sessionId, { transport, mcpServer });
      transport.onclose = () => {
        sessions.delete(sessionId);
        console.log(`[MCP] Session ${sessionId.slice(0, 8)} closed`);
      };

      console.log(`[MCP] New session ${sessionId.slice(0, 8)}`);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[MCP] POST error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  app.get('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (!sessionId || !sessions.has(sessionId)) {
      return res.status(404).json({ error: 'No active session' });
    }
    try {
      await sessions.get(sessionId).transport.handleRequest(req, res, null);
    } catch (err) {
      console.error('[MCP] GET error:', err.message);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  });

  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    if (sessions.has(sessionId)) {
      await sessions.get(sessionId).transport.close();
    }
    res.status(204).end();
  });

  app.listen(MCP_PORT, '127.0.0.1', () => {
    console.log(`[MCP] Streamable HTTP server listening on http://127.0.0.1:${MCP_PORT}/mcp`);
  });
}
