# Dashboard

## What it is

A browser UI at `http://127.0.0.1:8889` that shows ClaudeBot's live game state and lets you send commands without being inside Minecraft.

## What problem it solves

Minecraft captures the mouse cursor when you're playing — you can't type in a browser while in the game. The dashboard provides a parallel interface: you can Alt+Tab to it, type a command, and switch back to watch ClaudeBot react. It also maintains a permanent scrollable chat log, whereas Minecraft's chat fades after 10 seconds.

## How it works

The dashboard is served by `bot/dashboard.js`, which runs inside the bot process on port `8889`. It has three HTTP endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Serves `bot/public/index.html` (the dashboard UI) |
| `/api/status` | GET | Returns current bot state as JSON |
| `/api/events` | GET | SSE stream — pushes status updates every 2s and chat events |
| `/api/command` | POST | Accepts `{ message }`, appends to `chat-queue.txt` |

### Real-time updates (SSE)

When the browser loads, it opens a `GET /api/events` connection. The server holds the connection open and sends events as they happen:

- **status** events: pushed every 2 seconds; contains position, health, food, task, nearby players
- **chat** events: pushed when any player chats or ClaudeBot replies

The browser's JavaScript parses events and updates the UI without page reloads.

### Sending commands

When you type in the dashboard input box and press Enter, the browser sends:

```http
POST /api/command
Content-Type: application/json

{ "message": "@claude follow me" }
```

The server appends `Dashboard: @claude follow me\n` to `chat-queue.txt`. The agent runner picks this up identically to an in-game chat message — the source is transparent to Claude.

### Chat log

The dashboard keeps the last 100 messages in memory. When a new browser client connects to `/api/events`, the server immediately replays the full chat history so the log is populated on load.

Messages are styled by sender:
- **You** (commands sent from dashboard) — purple bubble, right-aligned
- **ClaudeBot** — blue bubble, left-aligned
- **Other players** — green bubble, left-aligned

## Recommended workflow

The most efficient way to interact with ClaudeBot:

1. Place the Minecraft window on the left half of the screen
2. Place the dashboard in a browser on the right half
3. Press **Escape** in Minecraft to release the cursor
4. Type commands in the dashboard
5. Click **Back to Game** in Minecraft to watch ClaudeBot react

This avoids Alt+Tab switching and keeps both views visible simultaneously.

## Limitations

- Commands sent from the dashboard prefix with `Dashboard:` not your Minecraft username. Claude sees `Dashboard: @claude follow me`, which still triggers correctly.
- The dashboard's position map is text-based (coordinates only), not a 2D map render.
- Chat history is in-memory only; it resets when the bot process restarts.
