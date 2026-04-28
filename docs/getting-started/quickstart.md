# Quickstart

Get ClaudeBot running and responding to commands in under 15 minutes.

**Prerequisites:** [Java 21+, Node.js 22, Claude Code CLI authenticated](prerequisites.md)

---

## 1. Install bot dependencies

```bash
cd bot
npm install
```

Expected output ends with: `added N packages`

---

## 2. Open three terminals

All three must stay open for the system to run. Use Git Bash for all of them.

---

## 3. Terminal 1 — Start the Minecraft server

```bash
cd server
bash start.sh
```

Wait for:
```
[XX:XX:XX INFO]: Done (12.090s)! For help, type "help"
```

This takes 15–60 seconds on first run.

---

## 4. Terminal 2 — Start the bot

```bash
cd bot
node index.js
```

Wait for both lines:
```
[MCP] Streamable HTTP server listening on http://127.0.0.1:8888/mcp
[Bot] Spawned in world
```

> **Important:** Wait for `Spawned in world` before proceeding. If you see `Gamemode: survival` on the next line, the configuration is correct.

---

## 5. Terminal 3 — Start the agent runner

```bash
cd agent
bash run.sh
```

Expected:
```
[Agent] ClaudeBot runner started. Watching .../bot/chat-queue.txt
[Agent] Press Ctrl+C to stop.
```

---

## 6. Verify the system with the smoke test

Open a fourth terminal:

```bash
node test/smoke-test.js
```

Expected within 45 seconds:
```
[Test] Connecting TestBot to server...
[Test] TestBot spawned. Waiting 3s then sending command...
[Test] Sending: @claude get status
[Test] PASS — ClaudeBot replied: "Status: HP=20 Food=20 Task=idle..."
```

If you see `PASS`, all three components are communicating correctly.

---

## 7. Open the dashboard

In a browser:
```
http://127.0.0.1:8889
```

The dashboard shows ClaudeBot's live position, health, and task. Type commands in the input box at the bottom.

---

## 8. Send your first command

In the dashboard input box (or press T in Minecraft), type:

```
@claude what do you see around you
```

Wait 15–20 seconds. ClaudeBot will reply in chat and in the dashboard.

---

## What just happened

- The Paper server is the game world ClaudeBot and you live in
- The bot process connects to the server as a fake player named ClaudeBot
- The agent runner watched the chat queue, detected your message, and ran `claude -p`
- Claude connected to the MCP server, called `get_nearby_blocks` and `get_nearby_entities`, and used `send_chat` to reply
- The dashboard received the reply via SSE and displayed it

## Next steps

- [Chat commands](../reference/chat-commands.md) — everything you can say to ClaudeBot
- [Onboarding](onboarding.md) — full mental model and how the components connect
- [Troubleshooting](../troubleshooting/common-issues.md) — if anything didn't work
