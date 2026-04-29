# Common issues

Top failures in order of frequency, with exact fixes.

---

## "ClaudeBot was slain by Zombie" / bot keeps dying

**Cause:** Server is in easy or normal difficulty. Hostile mobs spawn at night and attack ClaudeBot while it idles between commands.

**Fix:**
```bash
# Stop the server (Terminal 1: Ctrl+C)
# Edit server/server.properties:
difficulty=peaceful
# Restart the server
bash server/start.sh
```

---

## Bot connects and immediately disconnects: "You logged in from another location"

**Cause:** A previous bot process (from an earlier session) is still running and connected as ClaudeBot. When a new bot connects with the same username, the server kicks the old one, which reconnects, kicking the new one, ad infinitum.

**Fix:** Kill all Node.js processes before starting fresh.

```bash
# Windows (Git Bash)
taskkill //F //IM node.exe
# Then restart Terminal 2: node bot/index.js
```

---

## Mining reports success but inventory is always empty

**Cause:** ClaudeBot is in creative mode. In creative, `bot.dig()` breaks blocks but items never drop to inventory. `bot.inventory.items()` always returns `[]`.

**Verify:**
```bash
grep "Gamemode:" bot/bot.log
# If it says "Gamemode: creative" — that's the problem
```

**Fix:**
```bash
# Edit server/server.properties:
gamemode=survival
force-gamemode=true
# Delete stored player data so the change takes effect:
rm server/world/playerdata/*.dat
# Restart the server
```

---

## Agent runner never fires (chat-queue.txt stays empty)

**Cause 1:** You typed a message without `@claude` or `@team`. The bot listener only queues messages containing these keywords.

**Cause 2:** Two bot processes are running, causing the disconnect loop above. Neither bot stays connected long enough to receive chat.

**Verify:**
```bash
cat bot/chat-queue.txt
# Should contain your message after you type @claude ...
```

**Fix:** Ensure only one Node.js process is running. Then use `@claude` or `@team` prefix.

---

## `claude -p` hangs indefinitely

**Cause:** Missing `--permission-mode bypassPermissions` flag. Without it, Claude waits for human approval of each MCP tool call — which never arrives in non-interactive mode.

**Verify:** Check `agent/run.sh` contains `--permission-mode bypassPermissions`.

**Fix:**
```bash
# agent/run.sh should include:
claude -p \
  --permission-mode bypassPermissions \
  ...
```

---

## "Unknown or incomplete command" when typing `/gamemode`

**Cause:** Your player is not an operator (OP) on the server.

**Fix:** Add yourself to `server/ops.json`:

```json
[
  {
    "uuid": "YOUR-UUID-HERE",
    "name": "YourUsername",
    "level": 4,
    "bypassesPlayerLimit": false
  }
]
```

Find your UUID in `server/server.log`:
```bash
grep "UUID of player YourUsername" server/server.log
```

Then restart the server for ops.json to take effect.

---

## MCP server connection refused: curl returns 000 or connection error

**Cause:** The bot process (Terminal 2) is not running, or it crashed before the MCP server started.

**Verify:**
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST http://127.0.0.1:8888/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0"}},"id":1}'
# Should return 200
```

**Fix:** Restart Terminal 2: `node bot/index.js`. Wait for `[MCP] Streamable HTTP server listening`.

---

## Bot keeps disconnecting: "Server version '1.21.11' is not supported"

**Cause:** `mineflayer` version is below 4.37.0. Earlier versions only support up to 1.21.6.

**Fix:**
```bash
cd bot
npm install mineflayer@latest
```

Verify: `npm list mineflayer` should show `4.37.0` or higher.

---

## Dashboard shows "Reconnecting..." and never connects

**Cause:** The bot process is not running or the dashboard server failed to start.

**Fix:** Restart Terminal 2 and confirm you see both lines:
```
[MCP] Streamable HTTP server listening on http://127.0.0.1:8888/mcp
[Dashboard] http://127.0.0.1:8889
```

Then hard-refresh the browser (Ctrl+Shift+R).

---

## Lockfile stuck: agent runner stops processing commands

**Cause:** A `claude -p` invocation crashed without cleaning up `agent/claude-busy.lock`. The runner auto-removes stale locks after 60 seconds, but you can also remove it manually.

**Fix:**
```bash
rm agent/claude-busy.lock
```

---

## `craft_item` says "No recipe available" but you have the materials

**Cause:** The recipe system checks exact ingredient availability. If you have oak logs but asked for `oak_planks` without first converting the logs, or vice versa, the check may fail due to a mismatch between what the recipe expects and what's in inventory. More commonly, the item name is wrong.

**Verify:**
```bash
# Check what's actually in inventory
# In game: @claude what is in your inventory
# Then confirm the exact item ID needed — check the Minecraft wiki for registry names
```

**Fix:** Use exact Minecraft registry IDs (snake_case). `wooden_pickaxe` not `"Wooden Pickaxe"`. `oak_planks` not `"Oak Planks"`. If you need the planks first, craft them: `@claude craft oak_planks`.

---

## `place_block` reports "no adjacent solid block"

**Cause:** All six positions adjacent to the target coordinate are air. `place_block` requires at least one neighboring solid block to place against.

**Fix:** Choose a coordinate adjacent to an existing surface. If you want to build a column, place the first block at ground level (Y = surface), then place the next one on top of it (Y + 1), and so on. You cannot place blocks floating in mid-air in a single call.

---

## Combat stops immediately: "No zombie found within 20 blocks"

**Cause 1:** The entity name doesn't match. Mineflayer reports mob names using their internal type string (e.g., `Zombie`, `Skeleton`, `Creeper`). Your search string must be a substring of that name.

**Cause 2:** The mob is in an unloaded chunk, or is further than 20 blocks away.

**Verify:**
```
@claude what do you see around you
```

The response lists all nearby entities with their names as mineflayer sees them. Use those exact names.

**Fix:** Use the name exactly as shown in `get_nearby_entities`. Try `@claude attack zombie` (lowercase partial match works). Increase range if needed: the tool defaults to 20 blocks.

---

## `eat_food` says "No food items in inventory"

**Cause:** The bot's inventory contains nothing from the known food priority list. Custom server items or items with non-standard names are not recognized.

**Fix:** Specify the item name explicitly. If your server has an item called `magic_bread`, use: `@claude eat magic_bread`. If you want the auto-priority list to include it, add it to `FOOD_PRIORITY` in `bot/tools/inventory.js`.

---

## Waypoint goes to wrong location after bot restart

**Cause:** `bot/waypoints.json` stores rounded integer coordinates. If the bot was mid-air or at an unusual Y when the waypoint was saved, the stored Y might be off by 1 from where you intended.

**Fix:** Delete and re-save the waypoint with the bot standing at exactly the right position:

```
@claude delete waypoint base
@claude save waypoint base
```

---

## Smoke test fails: "FAIL — no reply from ClaudeBot within 45000ms"

**Cause:** One or more components are not running, or Claude took longer than 45 seconds.

**Checklist:**
1. Terminal 1: Paper server shows `Done!` and is accepting connections
2. Terminal 2: Bot shows `Spawned in world` and no repeated disconnect messages
3. Terminal 3: Agent runner shows `ClaudeBot runner started`
4. `claude auth status` returns logged in

If all three are running and the smoke test still fails, check `agent/agent.log` for Claude errors.
