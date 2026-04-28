# Configuration reference

Every configuration file in the project.

---

## agent/mcp-config.json

Tells `claude -p` where to find the MCP server.

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

| Field | Value | Notes |
|-------|-------|-------|
| `type` | `"http"` | Must be `"http"` for Streamable HTTP transport. The legacy `url`-only format uses deprecated SSE and will not work with Claude Code 2.x. |
| `url` | `http://127.0.0.1:8888/mcp` | The MCP endpoint exposed by `bot/mcp-server.js`. Must match `MCP_PORT` in `bot/mcp-server.js` (default: `8888`). |

---

## agent/prompt.md

System prompt appended to every `claude -p` invocation via `--append-system-prompt-file`. Defines ClaudeBot's persona and tool-use patterns.

Key directives in the prompt:

| Directive | Effect |
|-----------|--------|
| `Always call get_status first` | Claude reads position and state before acting |
| `send_chat under 80 characters` | Keeps in-game replies brief |
| `Never respond to your own messages` | Prevents chat loops |
| Tool-use patterns (Navigate, Mine, Follow...) | Guides Claude's tool call order |

---

## server/server.properties

Key settings for the Paper Minecraft server. Full file lives at `server/server.properties`.

| Property | Value | Why |
|----------|-------|-----|
| `online-mode` | `false` | Allows any Minecraft client to connect without a paid Mojang account |
| `server-ip` | `127.0.0.1` | Listens on loopback only; not accessible from the network |
| `server-port` | `25565` | Default Minecraft port; must match `SERVER_PORT` in `bot/index.js` |
| `gamemode` | `survival` | Required for item drops to work after mining |
| `force-gamemode` | `true` | Overrides player-stored gamemode on join; ensures ClaudeBot joins in survival |
| `difficulty` | `peaceful` | Prevents hostile mob spawns; ClaudeBot won't be killed while idle |
| `spawn-protection` | `0` | Allows bots and players to interact with blocks at spawn |
| `max-players` | `5` | Sufficient for one human + multiple bots |

---

## bot/index.js constants

Hardcoded in `bot/index.js`:

| Constant | Value | Where to change |
|----------|-------|-----------------|
| `BOT_NAME` | `ClaudeBot` | Line 10 of `index.js` |
| `SERVER_HOST` | `127.0.0.1` | Line 11 |
| `SERVER_PORT` | `25565` | Line 12 |
| `MC_VERSION` | `1.21.11` | Line 13 — must match the Paper server version |

---

## bot/mcp-server.js constants

| Constant | Value | Notes |
|----------|-------|-------|
| `MCP_PORT` | `8888` | Port the MCP HTTP server listens on |

---

## bot/dashboard.js constants

| Constant | Value | Notes |
|----------|-------|-------|
| `DASHBOARD_PORT` | `8889` | Port the dashboard HTTP server listens on |

---

## bot/package.json dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `mineflayer` | `^4.37.0` | Minecraft bot client — must be 4.37+ for 1.21.11 support |
| `mineflayer-pathfinder` | `^2.4.5` | A* pathfinding and navigation |
| `@modelcontextprotocol/sdk` | `^1.29.0` | MCP server implementation (`StreamableHTTPServerTransport`) |
| `express` | `^5.2.1` | HTTP server for MCP and dashboard endpoints |
| `zod` | `^4.3.6` | Tool input schema validation |
| `vec3` | `^0.2.0` | 3D vector math (used by pathfinder) |

---

## agent/run.sh variables

All paths are computed from `$SCRIPT_DIR` (the directory containing `run.sh`):

| Variable | Resolved path | Notes |
|----------|---------------|-------|
| `QUEUE_FILE` | `../bot/chat-queue.txt` | The file the runner polls |
| `LOCK_FILE` | `./claude-busy.lock` | Exists only while Claude is running |
| `MCP_CONFIG` | `./mcp-config.json` | Passed to `claude -p --mcp-config` |
| `PROMPT_FILE` | `./prompt.md` | Passed to `claude -p --append-system-prompt-file` |
| `LOG_FILE` | `./agent.log` | Invocation log |

The poll interval (500ms) and stale-lock threshold (60s) are hardcoded in `run.sh`.
