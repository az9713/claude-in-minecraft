# Restart Guide

Everything you need to bring the system back up after a reboot. Follow the steps in order — skipping any step causes problems.

---

## Before you start: kill any leftover processes

Always run this first, even if you think nothing is running:

```bash
taskkill //F //IM java.exe
taskkill //F //IM node.exe
```

This prevents the "You logged in from another location" loop that happens when an old bot process is still connected.

---

## Step 1 — Terminal 1: Start the Minecraft server

```bash
cd ~/Downloads/minecraft_headless_agent_allaboutai/server
bash start.sh
```

**Wait for this line before doing anything else:**
```
Done (12.090s)! For help, type "help"
```

Takes 15–60 seconds. Do not proceed until you see it.

---

## Step 2 — Terminal 2: Start the bot

```bash
cd ~/Downloads/minecraft_headless_agent_allaboutai/bot
node index.js
```

**Wait for both of these lines:**
```
[MCP] Streamable HTTP server listening on http://127.0.0.1:8888/mcp
[Bot] Spawned in world
```

Also check the next line says `Gamemode: survival` — not `Gamemode: creative`. If it says creative, see the troubleshooting section below.

---

## Step 3 — Terminal 3: Start the agent runner

```bash
cd ~/Downloads/minecraft_headless_agent_allaboutai/agent
bash run.sh
```

**Wait for:**
```
[Agent] ClaudeBot runner started.
```

---

## Step 4 — Open the dashboard

In your browser:
```
http://127.0.0.1:8889
```

You should see ClaudeBot's position and health updating live.

---

## Step 5 — Join Minecraft (optional, for visual)

- Open Minecraft Java Edition 1.21.11
- Multiplayer → **ClaudeBot** server → join
- Your username is `az9713`
- After joining, run these commands once to set up the session:

```
/time set day
/gamerule doDaylightCycle false
/gamemode creative
```

> The last command puts YOU in creative mode (so you can fly and won't die). ClaudeBot stays in survival — that's correct.

---

## Step 6 — Test it works

In the dashboard or Minecraft chat (press T):

```
@claude get status
```

ClaudeBot should reply within 20 seconds with its position, health, and task.

---

## Demo commands to show off

```
@claude follow me
```
Fly in any direction — ClaudeBot will sprint after you.

```
@claude stop
```
ClaudeBot freezes.

```
@claude what do you see around you
```
ClaudeBot scans and reports nearby blocks and entities.

```
@claude mine 3 oak_log
```
ClaudeBot walks to a tree, chops 3 logs, picks them up.

```
@claude what is in your inventory
```
Should show `oak_log x3`.

---

## Flying in Minecraft (creative mode)

| Key | Action |
|-----|--------|
| Double-tap Space | Start / stop flying |
| Hold Space | Go up |
| Hold Shift | Go down |
| Esc | Release cursor (so you can use browser/dashboard) |
| T | Open chat |
| F3 | Show coordinates (top-left of screen) |
| F11 | Toggle fullscreen |

---

## Troubleshooting

**Bot joins in creative mode (inventory always empty after mining)**
```bash
# Stop everything first
taskkill //F //IM java.exe
taskkill //F //IM node.exe

# Delete stored player data
rm server/world/playerdata/*.dat

# Verify server.properties has these settings:
# gamemode=survival
# force-gamemode=true
# difficulty=peaceful

# Then restart from Step 1
```

**ClaudeBot keeps disconnecting ("You logged in from another location")**
```bash
taskkill //F //IM node.exe
# Wait 5 seconds, then restart Terminal 2
```

**Claude never replies (agent runner fires but no response in chat)**
- Check `agent/agent.log` for errors
- Verify MCP server is running: open browser at `http://127.0.0.1:8888/mcp` — should get a response
- Check Claude is logged in: `claude auth status`

**Stale lockfile (runner stops processing after a crash)**
```bash
rm agent/claude-busy.lock
```

**It got dark / mobs appeared**
```
/time set day
/kill @e[type=!player]
```

**ClaudeBot can't find trees or sheep**
You need to be near the resources. In creative mode, double-tap Space to fly, find a forest or open field, then issue the command. ClaudeBot searches within 32 blocks of its current position.

---

## Server settings (already configured — do not change)

| Setting | Value | Why |
|---------|-------|-----|
| `gamemode=survival` | survival | So mined blocks drop items |
| `force-gamemode=true` | true | So ClaudeBot always joins in survival |
| `difficulty=peaceful` | peaceful | No hostile mobs; ClaudeBot won't be killed while idle |
| `online-mode=false` | false | Allows joining without a paid Mojang account check |

---

## GitHub repo

https://github.com/az9713/claude-in-minecraft
