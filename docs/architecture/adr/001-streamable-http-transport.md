# ADR 001: Use Streamable HTTP transport for MCP

**Status:** Accepted

## Context

The MCP server (bot/mcp-server.js) needs to be reachable by `claude -p` on each invocation. MCP supports two transports:

1. **stdio** — starts a subprocess; the subprocess IS the MCP server
2. **SSE (deprecated)** — HTTP server with `/sse` endpoint for server-sent events
3. **Streamable HTTP** — HTTP server with a single `/mcp` endpoint handling POST/GET/DELETE

The bot process must be **persistent** — it holds the long-lived TCP connection to the Minecraft server. This rules out stdio, which starts and kills a subprocess on each `claude -p` invocation.

Between SSE and Streamable HTTP, the MCP spec deprecated SSE in March 2025 (spec version 2025-03-26). Claude Code 2.x requires `{ "type": "http" }` in mcp-config.json for Streamable HTTP; the old URL-only format triggers the deprecated SSE transport and fails.

## Decision

Use Streamable HTTP transport with a single `/mcp` endpoint on `127.0.0.1:8888`.

`mcp-config.json`:
```json
{
  "mcpServers": {
    "minecraft": {
      "type": "http",
      "url": "http://127.0.0.1:8888/mcp"
    }
  }
}
```

## Alternatives considered

### stdio transport
Each `claude -p` invocation would start a fresh `node bot/index.js` process as the MCP server. This process would connect to Minecraft, immediately disconnect when Claude exits, and the bot would be offline between commands. Rejected: the bot must be persistent.

### SSE transport (deprecated)
Would work in Claude Code 1.x but fails in 2.x. The 406 "Not Acceptable" error on initialization is the observable failure. Rejected: deprecated and broken with current Claude Code versions.

## Rationale

Streamable HTTP is the only transport that supports a persistent server process that Claude connects to per-invocation without managing server lifecycle. The `type: "http"` field in mcp-config.json is the correct discriminator for this transport in Claude Code 2.x.

## Trade-offs

- The MCP server requires `Accept: application/json, text/event-stream` on requests — standard for Streamable HTTP but not obvious. Raw `curl` tests must include this header.
- Session management (UUID per claude -p invocation, stored in a `Map`) adds a small memory overhead — negligible at this scale.

## Consequences

- The bot process must be started before `claude -p` is invoked. If port 8888 is not listening, Claude will fail to initialize and exit with an error.
- Multiple simultaneous `claude -p` invocations (e.g., smoke test + real command) each create their own MCP session but share `state` — last writer wins on `activeTask`.
