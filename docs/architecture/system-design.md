# System design

## High-level architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  GAME LAYER                                                      │
│                                                                  │
│  Minecraft Java Client (human player)                            │
│          ↕ TCP :25565                                            │
│  Paper MC Server 1.21.11                                         │
│          ↕ TCP :25565                                            │
│  Mineflayer Bot ("ClaudeBot")                                    │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  BOT PROCESS  (bot/index.js, Node.js, persistent)               │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Mineflayer │  │  MCP HTTP server │  │  Dashboard HTTP  │   │
│  │  bot client │  │  :8888/mcp       │  │  server :8889    │   │
│  └──────┬──────┘  └────────┬─────────┘  └────────┬─────────┘   │
│         │                  │                      │              │
│         └──────────────────┴──────────────────────┘             │
│                            │                                     │
│                      state { bot, activeTask }                   │
│                            │                                     │
│                     500ms tick loop                              │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  AGENT LAYER                                                     │
│                                                                  │
│  chat-queue.txt ←── bot chat listener (filtered: @claude/@team) │
│        ↓                                                         │
│  agent/run.sh (polls every 500ms, lockfile concurrency)         │
│        ↓                                                         │
│  claude -p --mcp-config agent/mcp-config.json "message"         │
│        ↕ Streamable HTTP                                         │
│  MCP server :8888                                                │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  UI LAYER                                                        │
│                                                                  │
│  Browser → http://127.0.0.1:8889                                │
│         ← SSE stream (status every 2s, chat events)            │
│         → POST /api/command (writes to chat-queue.txt)          │
└──────────────────────────────────────────────────────────────────┘
```

## Component breakdown

| Component | Process | Port | Lifetime |
|-----------|---------|------|----------|
| Paper MC server | Java | 25565 | Long-lived (Terminal 1) |
| Mineflayer bot | Node.js (part of bot process) | — | Long-lived, auto-reconnects |
| MCP HTTP server | Node.js (part of bot process) | 8888 | Long-lived |
| Dashboard HTTP server | Node.js (part of bot process) | 8889 | Long-lived |
| Agent runner | bash | — | Long-lived loop (Terminal 3) |
| `claude -p` | Node.js subprocess | — | Per-command (15–20s) |

## Data flows

### Command flow (in-game chat)

```
Human types "@claude follow me" in Minecraft
  → Paper server broadcasts to all clients
  → Mineflayer bot receives chat packet
  → chat listener: contains "@claude" → true
  → appendFileSync("chat-queue.txt", "YourUsername: @claude follow me\n")
  → agent runner polls, reads file, clears it, creates lockfile
  → spawns: claude -p --mcp-config ... "YourUsername: @claude follow me"
  → Claude connects to MCP, calls get_status()
  → MCP returns: { pos, health, food, activeTask: "idle" }
  → Claude calls follow_player({ playerName: "YourUsername", range: 3 })
  → MCP handler: state.activeTask = { kind: "follow", playerName: "YourUsername", range: 3 }
  → MCP returns: "Following YourUsername"
  → Claude calls send_chat({ message: "Following YourUsername" })
  → bot.chat("Following YourUsername") → Paper server → all clients see it
  → Claude exits
  → agent runner deletes lockfile
  → tick loop continues: every 500ms, GoalFollow(YourUsernameentity, 3) updated
```

### Command flow (dashboard)

```
Human types "@claude follow me" in dashboard
  → POST /api/command { message: "@claude follow me" }
  → server appends "Dashboard: @claude follow me\n" to chat-queue.txt
  → [identical to in-game flow from this point]
```

### Status update flow (dashboard)

```
Every 2 seconds:
  → dashboardEmitter.emit("event", { type: "status", ...getStatus(state) })
  → SSE stream pushes to all connected browsers
  → Browser JS updates position, health, food, task displays
```

### Mining flow

```
Claude calls mine_block({ blockName: "oak_log", count: 3 })
  → state.activeTask = { kind: "mine", blockName: "oak_log", count: 3, mined: 0 }
  → returns "Mining 3 oak_log" immediately
  → Claude calls send_chat("Mining 3 oak_log"), exits
  → tick loop fires every 500ms:
      blockType = bot.registry.blocksByName["oak_log"]
      block = bot.findBlock({ matching: blockType.id, maxDistance: 32 })
      if !block → chat "No oak_log found", activeTask = idle
      else:
        task.busy = true
        await pathfinder.goto(GoalNear(block.pos, 1))   ← 1 block range for pickup
        await bot.dig(block)
        task.mined++
        await sleep(1500)  ← wait for item drop and auto-collect
        task.busy = false
      repeat until mined >= count → chat "Done mining 3 oak_log", activeTask = idle
```

## Key design decisions

See [ADR 001](adr/001-streamable-http-transport.md), [ADR 002](adr/002-polling-loop-over-persistent-session.md), and [ADR 003](adr/003-survival-peaceful-configuration.md) for detailed rationale.

| Decision | Choice | Alternative rejected |
|----------|--------|---------------------|
| MCP transport | Streamable HTTP | Deprecated SSE transport |
| Claude invocation model | Per-message `claude -p` | Persistent `claude` session |
| Bot gamemode | Survival + peaceful | Creative (no item drops) |
| Concurrency model | Single lockfile | Parallel invocations |
| activeTask location | Bot process memory | Claude session state |

## Dependencies

| External dependency | Version | Used by |
|---------------------|---------|---------|
| Minecraft Java Edition | 1.21.11 | Server + client |
| Paper MC | 1.21.11-69 | Server |
| Node.js | 22 LTS | Bot process |
| Java | 21+ | Paper server |
| Claude Code CLI | 2.x | Agent runner |
| `mineflayer` | 4.37.0+ | Bot |
| `mineflayer-pathfinder` | 2.4.5 | Bot navigation |
| `@modelcontextprotocol/sdk` | 1.29.0+ | MCP server |

## Scaling characteristics

**What scales:** Multiple bots can run simultaneously by launching separate bot processes on different ports (e.g., `BOT_NAME=Claude2 MCP_PORT=8890 node index.js`), each with its own agent runner.

**What doesn't scale:** The polling loop adds 0–500ms latency per command regardless of load. This is acceptable for a single-user game companion but not for high-frequency command volumes.

**Memory:** The bot process uses ~200MB resident. The Paper server uses ~1.5GB with default `-Xmx2G` flag.
