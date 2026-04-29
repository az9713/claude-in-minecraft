# Bot & MCP server

## What it is

`bot/index.js` is the core process of the system. It runs three servers simultaneously — a Mineflayer Minecraft client, a MCP HTTP server, and a dashboard HTTP server — all sharing a single in-memory state object.

## What problem it solves

Claude can't directly control a Minecraft bot. It can only call typed tool functions. The bot process bridges this gap: it maintains a persistent Minecraft connection (which requires a long-lived TCP socket) while exposing a stateless HTTP API for Claude to call per-command.

## How it works

### Startup sequence

1. `state` object created: `{ bot: null, activeTask: { kind: 'idle' } }`
2. MCP HTTP server starts on `127.0.0.1:8888`
3. Dashboard HTTP server starts on `127.0.0.1:8889`
4. `chat-queue.txt` cleared
5. Mineflayer bot connects to `127.0.0.1:25565` as `ClaudeBot`
6. On `spawn` event: pathfinder initialised, `state.bot` set, welcome message sent
7. 500ms tick loop starts

### Chat listener

Every chat message in the Minecraft world triggers the bot's `chat` event. The listener:

1. Filters out the bot's own messages (prevents self-loop)
2. Logs all messages to the dashboard via `logBotChat` / `logPlayerChat`
3. Checks if the message contains `@claude` or `@team` (case-insensitive)
4. If matched, appends `username: message\n` to `chat-queue.txt`

### Tick loop

Runs every 500ms while the bot is connected. Reads `state.activeTask` and executes ongoing work:

| `activeTask.kind` | What the tick loop does |
|---|---|
| `idle` | Nothing |
| `follow` | Updates `pathfinder.setGoal(new GoalFollow(targetEntity, range))` dynamically |
| `mine` | Calls `executeMineTask` — navigates within 1 block, digs, waits 1.5s for item pickup |
| `collect` | Calls `executeCollectTask` — navigates to nearest dropped item entity |
| `attack` | Calls `executeAttackTask` — chases and attacks target entity; declares victory when entity is gone |
| `navigate` | Set by `navigate_to`, `goto_waypoint`; pathfinder handles movement; tick loop does not act on it |

The `busy` flag on active tasks prevents re-entrant execution while an async operation is in flight.

### Reconnect loop

When the bot disconnects (server restart, kick, network error), the `end` event fires:
- `state.bot` set to `null`
- `state.activeTask` reset to `idle`
- `createBot()` called again after 5 seconds

The MCP server and dashboard keep running during reconnect — they handle `state.bot === null` gracefully by returning `"Bot not connected"`.

## MCP server internals (`bot/mcp-server.js`)

The MCP server uses `@modelcontextprotocol/sdk`'s `StreamableHTTPServerTransport`. Each `claude -p` invocation creates one MCP session:

1. Claude sends `POST /mcp` with an `initialize` request
2. Server creates a new `StreamableHTTPServerTransport`, assigns a UUID session ID
3. Server creates a new `McpServer` instance and connects it to the transport
4. Session ID is returned in the `mcp-session-id` response header
5. All subsequent Claude requests include that session ID header
6. When Claude exits, the session is closed and the transport is garbage-collected

Multiple sessions can coexist (e.g., smoke test running while a real command is in flight), but `state` is shared — the last writer wins.

## Tool registration

Tools are registered in seven files under `bot/tools/`:

| File | Tools registered |
|---|---|
| `tools/status.js` | `get_status` |
| `tools/chat.js` | `send_chat` |
| `tools/navigation.js` | `navigate_to`, `follow_player`, `stop_action`, `rejoin_server` |
| `tools/world.js` | `mine_block`, `get_nearby_blocks`, `get_nearby_entities`, `craft_item`, `place_block` |
| `tools/inventory.js` | `get_inventory`, `collect_nearby_items`, `eat_food`, `drop_item` |
| `tools/combat.js` | `attack_entity` |
| `tools/waypoints.js` | `save_waypoint`, `goto_waypoint`, `list_waypoints`, `delete_waypoint` |

Each tool uses Zod for input validation and returns `{ content: [{ type: 'text', text: '...' }] }`.

## Key data structures

```js
// Shared state — passed by reference to all MCP tools
state = {
  bot: null | MineflayerBot,   // null when disconnected
  activeTask: {
    kind: 'idle' | 'navigate' | 'follow' | 'mine' | 'collect' | 'attack',
    // kind-specific fields:
    // follow:  { playerName, range }
    // mine:    { blockName, count, range, mined, busy }
    // navigate:{ x, y, z }
    // collect: { itemName, range, busy }
    // attack:  { targetName, range, targetId, busy }
  }
}
```

## Interaction with other subsystems

- **Agent runner** reads `chat-queue.txt` written by the chat listener
- **Claude** connects to the MCP server per invocation
- **Dashboard** reads `state` via SSE push every 2 seconds
- **Paper server** is the remote the Mineflayer bot connects to

## Common gotchas

**Bot joins in creative mode:** `force-gamemode=true` must be set in `server.properties`. Without it, stored player data overrides the server default. In creative mode, `bot.dig()` succeeds but items never drop to inventory.

**`bot.pathfinder` is undefined:** `bot.loadPlugin(pathfinder)` must be called before any `bot.pathfinder` access. It's called in `createBot()` immediately after `createBot()` returns the bot instance.

**Items not collected after mining:** The bot must be within 1 block of the dropped item. The mine task uses `GoalNear(..., 1)` — not `GoalNear(..., 3)` — so the bot stands adjacent to the block before digging.

**ESM import errors for mineflayer-pathfinder:** `mineflayer-pathfinder` is CommonJS. Import with `import pkg from 'mineflayer-pathfinder'; const { pathfinder, goals } = pkg;` — not named imports.
