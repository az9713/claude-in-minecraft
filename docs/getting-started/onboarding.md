# Onboarding

## What is this, really?

Think of ClaudeBot like a remote-controlled robot in a game world. You give it instructions in plain English. It figures out what tools to use. A separate system (the Mineflayer bot) moves the robot's body in response.

Claude never sees Minecraft. Claude reads a text message and calls functions. Mineflayer converts those function calls into game actions — walking, digging, sending chat. The intelligence (Claude) and the body (Mineflayer) are completely separate.

If you've used LLM tool use before, this is exactly that: Claude gets a list of 11 tools, picks the right ones, calls them in sequence, and reports back. The only difference is the tools happen to control a Minecraft character instead of a database.

---

## Why does it take 15–20 seconds to respond?

Each command goes through five layers:

1. **Chat → file** (~instant): The bot process appends your message to `chat-queue.txt`
2. **File → claude process** (~0.5s): The agent runner polls every 500ms, detects the message
3. **Claude startup** (~3s): `claude -p` starts, loads config, connects to the MCP server
4. **Tool calls** (~5–10s): Claude calls `get_status` (to read game state), then the relevant action tool, then `send_chat` (to confirm)
5. **Claude exits** (~1s): The agent runner releases the lockfile

Most of the time is Claude itself thinking and calling tools. This is one invocation of Claude per message — not a persistent connection.

---

## Why three terminals?

Each process has a different lifecycle:

| Terminal | Process | Why it runs separately |
|----------|---------|----------------------|
| Terminal 1 | Paper server | Needs its own stdin/stdout for server logs |
| Terminal 2 | Bot + MCP + Dashboard | Long-lived; must not restart between commands |
| Terminal 3 | Agent runner | Polls a file and spawns subprocesses |

The bot process (Terminal 2) is the core. It hosts three things simultaneously: the Mineflayer client (which holds the TCP connection to the Minecraft server), the MCP HTTP server (which Claude connects to), and the dashboard HTTP server (which your browser connects to). All three share the same in-memory `state` object, which is how they stay in sync.

---

## What is the MCP server?

The MCP server is a translation layer. Claude knows how to call "tools" — named functions with typed parameters. The MCP server defines 11 such tools and maps each one to a Mineflayer API call.

When Claude calls `navigate_to(x=10, y=64, z=-50)`, the MCP server does:
```js
state.activeTask = { kind: 'navigate', x: 10, y: 64, z: -50 };
bot.pathfinder.setGoal(new GoalNear(10, 64, -50, 2));
```

When Claude calls `get_status()`, the MCP server reads `bot.entity.position`, `bot.health`, `bot.food`, and `state.activeTask`, and returns them as JSON.

Claude never directly touches Mineflayer. It only knows about the 11 MCP tools.

---

## Why does ClaudeBot stay moving between claude -p calls?

This is the most surprising design choice. When Claude calls `follow_player`, Claude's job is done — it exits. But ClaudeBot keeps following you. How?

The `activeTask` state lives in the bot process, not in Claude. The 500ms tick loop in `bot/index.js` continuously reads `activeTask` and updates the pathfinder goal. When Claude sets `activeTask = { kind: 'follow', playerName: 'YourUsername' }` and exits, the tick loop keeps running — it doesn't care that Claude is gone.

This means:
- Claude is stateless (exits after each command)
- The bot process is stateful (runs forever, holds `activeTask`)
- Long-running tasks (follow, mine many blocks) work correctly across command boundaries

---

## Why peaceful + survival mode?

Two requirements conflict:
1. **Survival mode** — needed so mining produces item drops that go to inventory. In creative mode, blocks break but items never drop.
2. **No mob deaths** — ClaudeBot idles in the world between commands and will be killed by zombies/skeletons if left alone.

Peaceful difficulty removes hostile mobs (zombies, skeletons, creepers) but keeps passive mobs (sheep, pigs, cows) and lets item drops work normally. Survival + peaceful is the combination that satisfies both requirements.

`force-gamemode=true` in `server.properties` ensures ClaudeBot always joins in survival, even if previous player data said creative.

---

## Where to go next

- [Chat commands](../reference/chat-commands.md) — the full list of things you can say to ClaudeBot
- [MCP tools reference](../reference/mcp-tools.md) — what happens internally when you give each command
- [System design](../architecture/system-design.md) — component diagram and data flows
- [Common issues](../troubleshooting/common-issues.md) — if something isn't working
