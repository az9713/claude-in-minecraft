# The waypoint system

Waypoints are named, persistent locations ClaudeBot can save and navigate to across sessions. Save your base, your mine entrance, your farm — then tell ClaudeBot to go there by name without looking up coordinates.

---

## What it solves

Navigation tools like `navigate_to` require exact coordinates every time. This works for one-off movement, but not for locations you return to repeatedly. The waypoint system gives those locations permanent names so you can say `@claude go to base` instead of `@claude go to -9 63 -52`.

Waypoints persist to disk in `bot/waypoints.json` and survive bot restarts, agent restarts, and PC reboots.

---

## How it works

### Storage

Waypoints live in `bot/waypoints.json` — a plain JSON file written and read by the waypoint tools. It is gitignored (like `bot.log` and `chat-queue.txt`) because it holds server-specific data that differs per deployment.

```json
{
  "base": { "x": -9, "y": 63, "z": -52 },
  "mine": { "x": 142, "y": 11, "z": 87 },
  "farm": { "x": 23, "y": 64, "z": -18 }
}
```

Keys are always lowercase — `save_waypoint("Base")` and `save_waypoint("base")` write to the same key.

### `save_waypoint`

Reads `bot.entity.position` at the moment of the call, rounds all three coordinates to integers, and writes them to the JSON file under the given name. Returns the saved coordinates for confirmation.

### `goto_waypoint`

Reads the JSON file, looks up the name (case-insensitive), and calls `bot.pathfinder.setGoal(new GoalNear(x, y, z, 2))`. Sets `state.activeTask = { kind: 'navigate', x, y, z }` so the dashboard shows "navigate" during the trip. The bot travels in the background; the tool returns immediately with the target coordinates.

### `list_waypoints`

Reads the JSON file and formats each entry as `name: x y z`. If the file doesn't exist or is empty, returns "No waypoints saved yet".

### `delete_waypoint`

Removes the entry from the JSON file and saves it. Returns an error if the name doesn't exist.

### File locking

The tools use synchronous `readFileSync` and `writeFileSync` — no async I/O. Because only one `claude -p` invocation runs at a time (enforced by the agent runner lockfile), there is no concurrent write risk.

---

## Dashboard integration

The dashboard polls `GET /api/waypoints` every 5 seconds and renders the result as a Waypoints panel in the left sidebar. Each entry shows the waypoint name and its coordinates. The panel updates automatically when new waypoints are saved.

```
Waypoints
─────────────────────────
base    -9 63 -52
mine   142 11  87
farm    23 64 -18
```

The dashboard does not support deleting waypoints — use `@claude delete waypoint mine` in game chat.

---

## Interaction with other subsystems

- **Pathfinder:** `goto_waypoint` delegates to the same `GoalNear` pathfinding used by `navigate_to`. The bot avoids obstacles, handles elevation changes, and can traverse water or ladders.
- **Dashboard:** `/api/waypoints` endpoint added to `bot/dashboard.js`, reads the same `bot/waypoints.json` file the tools use.
- **Agent runner:** No special integration — waypoint commands flow through the normal chat queue like any other command.

---

## Common gotchas

**Waypoints saved at wrong coordinates:** `save_waypoint` captures the bot's position at call time, not your position. If you want to save your current location, stand next to ClaudeBot (or use `follow_player` to bring it to you), then save the waypoint.

**`goto_waypoint` says "Unknown waypoint":** Names are case-insensitive and lowercased on save. Check `list_waypoints` to see exact stored names. If you saved as `"Farm"`, it is stored and looked up as `"farm"`.

**Bot pathfinds to waypoint but undershoots:** `goto_waypoint` uses a 2-block arrival radius. If you need the bot at a precise block (e.g., standing inside a room), navigate manually for the last few blocks with `navigate_to`.

**`bot/waypoints.json` missing after a fresh clone:** The file is gitignored — it is not committed to the repository. Start fresh, save your first waypoint with `@claude save waypoint base`, and the file is created automatically.
