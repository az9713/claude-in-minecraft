# What is this?

A system that makes Claude Code play Minecraft alongside a human — as a real in-game character with a body, position, and the ability to walk, mine, and chat.

## The problem it solves

Minecraft is more fun with companions. AI companions in games are usually scripted NPCs with fixed behaviours. This project replaces that with a real LLM: you type natural language in game chat, Claude thinks, and a bot character physically acts in the world. No scripting. No fixed commands. Just conversation.

## How it works

Claude never "sees" Minecraft. It reads a chat message (plain text) and calls tools (functions). Mineflayer translates those tool calls into actual game actions — movement, mining, pathfinding. The illusion of an AI playing Minecraft is built from these three layers working together:

```
You type in chat
      ↓
Mineflayer bot receives the message, writes it to a queue file
      ↓
Agent runner detects the file, invokes: claude -p "message"
      ↓
Claude calls MCP tools: navigate_to, mine_block, send_chat, etc.
      ↓
MCP server translates tool calls into Mineflayer bot actions
      ↓
ClaudeBot physically moves/mines/speaks in the game world
```

## Architecture overview

```
┌─────────────────────────────────────────────────────┐
│  Minecraft Java 1.21.11 (your game client)          │
│  ↕ connects to                                      │
│  Paper MC Server :25565                             │
│       ↕ Minecraft protocol                          │
│  bot/index.js  (Node.js, persistent process)        │
│  ├── Mineflayer bot "ClaudeBot"                     │
│  ├── Chat listener → chat-queue.txt                 │
│  ├── activeTask tick loop (500ms)                   │
│  ├── MCP HTTP server :8888/mcp                      │
│  └── Dashboard HTTP server :8889                    │
│       ↕ Streamable HTTP                             │
│  agent/run.sh  (bash polling loop)                  │
│  └── invokes: claude -p --mcp-config ...            │
│                                                     │
│  Browser → http://127.0.0.1:8889  (dashboard)      │
└─────────────────────────────────────────────────────┘
```

## How the pieces fit together

A typical command cycle takes 15–20 seconds end-to-end:

1. You type `@claude follow me` in Minecraft chat (or the dashboard)
2. The Mineflayer bot's chat listener appends `az9713: @claude follow me` to `chat-queue.txt`
3. The bash agent runner polls the file every 500ms, detects content, acquires a lockfile
4. The runner invokes `claude -p --mcp-config agent/mcp-config.json "az9713: @claude follow me"`
5. Claude connects to the MCP server at `http://127.0.0.1:8888/mcp`, lists 11 available tools
6. Claude calls `get_status` to read ClaudeBot's position, then calls `follow_player`
7. The MCP server's `follow_player` handler sets `state.activeTask = { kind: 'follow', playerName: 'az9713' }`
8. The 500ms tick loop detects `activeTask.kind === 'follow'` and continuously updates the pathfinder goal
9. ClaudeBot physically walks toward you; Claude calls `send_chat("Following az9713")` to confirm
10. The runner releases the lockfile; dashboard updates in real time via SSE

## What this is not

- **Not a Minecraft mod.** No bytecode injection, no Forge/Fabric. The bot is a separate network client.
- **Not a real-time AI loop.** Claude is invoked per-message, not continuously. Each command is one `claude -p` invocation.
- **Not multi-server.** The system is designed for a single private local server.
- **Not autonomous.** ClaudeBot only acts when it receives a command. It does not explore or gather resources on its own initiative.
