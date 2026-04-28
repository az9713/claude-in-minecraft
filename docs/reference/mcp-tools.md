# MCP tools reference

All 11 tools exposed by `bot/mcp-server.js`. Claude discovers these at session start via `tools/list` and calls them to act in the game.

All tools return `{ content: [{ type: 'text', text: '...' }] }`. All tools return `"Bot not connected"` if the Mineflayer bot has not yet spawned or is reconnecting.

---

## get_status

Returns ClaudeBot's current position, vitals, active task, and nearby players. Claude calls this first in most interactions to establish context.

**Inputs:** none

**Returns:** JSON string

```json
{
  "pos": { "x": -9, "y": 63, "z": -52 },
  "health": 20,
  "food": 20,
  "activeTask": "idle",
  "nearbyPlayers": [{ "name": "YourUsername", "distance": 4 }]
}
```

---

## send_chat

Sends a message in Minecraft game chat, visible to all connected players and in the dashboard.

**Inputs:**

| Field | Type | Required | Constraint |
|-------|------|----------|------------|
| `message` | string | yes | max 100 characters |

**Returns:** `"sent"`

> **Note:** Do not use this tool to respond to ClaudeBot's own messages — the bot filters its own chat to prevent loops, but Claude should not re-chat what was already sent.

---

## navigate_to

Pathfinds ClaudeBot to a set of coordinates. Returns immediately; movement continues in the background via the tick loop.

**Inputs:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `x` | number | yes | — | Target X coordinate |
| `y` | number | yes | — | Target Y coordinate (use 64 if unsure) |
| `z` | number | yes | — | Target Z coordinate |
| `range` | number | no | 2 | Stop within this many blocks of the target |

**Returns:** `"Navigating to X Y Z"`

**Side effect:** Sets `activeTask = { kind: 'navigate', x, y, z }`

---

## follow_player

Follows a named player continuously until `stop_action` is called. The tick loop updates the pathfinder goal every 500ms, so ClaudeBot tracks moving targets.

**Inputs:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `playerName` | string | yes | — | Exact in-game username (case-sensitive) |
| `range` | number | no | 3 | Follow distance in blocks |

**Returns:** `"Following {playerName}"` or `"Player {playerName} not found or not in range"`

**Side effect:** Sets `activeTask = { kind: 'follow', playerName, range }`

---

## stop_action

Stops all current movement and tasks. Clears the pathfinder goal and resets `activeTask` to idle.

**Inputs:** none

**Returns:** `"Stopped, now idle"`

**Side effect:** Sets `activeTask = { kind: 'idle' }`, calls `bot.pathfinder.setGoal(null)`

---

## mine_block

Finds the nearest block of a given type within range and mines it (up to `count` times). Returns immediately; mining continues in the background via the tick loop.

**Inputs:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `blockName` | string | yes | — | Minecraft block ID, e.g. `oak_log`, `stone`, `coal_ore` |
| `count` | integer | no | 1 | Number of blocks to mine |
| `range` | number | no | 32 | Search radius in blocks |

**Returns:** `"Mining {count} {blockName}"`

**Side effect:** Sets `activeTask = { kind: 'mine', blockName, count, range, mined: 0 }`

> **Note:** Requires survival mode. In creative mode, `bot.dig()` succeeds but items never drop to inventory.

> **Note:** The bot navigates within 1 block of each target before digging, then waits 1.5s for item auto-pickup. Items must be on the ground at foot level.

---

## get_nearby_blocks

Lists block types within a radius, aggregated by type with counts and nearest position.

**Inputs:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `range` | number | no | 16 | Search radius in blocks |
| `filter` | string | no | — | Partial block name filter, e.g. `"log"`, `"ore"` |

**Returns:** JSON array (max 20 entries, sorted by count descending)

```json
[
  { "type": "oak_log", "count": 117, "nearestPos": { "x": -42, "y": 70, "z": -42 } },
  { "type": "birch_log", "count": 23, "nearestPos": { "x": -38, "y": 68, "z": -39 } }
]
```

---

## get_nearby_entities

Lists entities (players, mobs, animals) within a radius, sorted by distance.

**Inputs:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `range` | number | no | 32 | Search radius in blocks |

**Returns:** JSON array (max 20 entries)

```json
[
  { "name": "YourUsername", "type": "player", "distance": 4, "pos": { "x": -9, "y": 63, "z": -48 } },
  { "name": "Sheep", "type": "mob", "distance": 18, "pos": { "x": 5, "y": 64, "z": -60 } }
]
```

---

## get_inventory

Lists all non-empty inventory slots.

**Inputs:** none

**Returns:** JSON array

```json
[
  { "name": "oak_log", "count": 3, "slot": 36 },
  { "name": "stone", "count": 7, "slot": 37 }
]
```

Returns `[]` if inventory is empty.

---

## collect_nearby_items

Pathfinds to the nearest dropped item entities in the world and picks them up.

**Inputs:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `itemName` | string | no | — | Filter by partial item name, e.g. `"oak"`. Omit to collect all items. |
| `range` | number | no | 16 | Search radius in blocks |

**Returns:** `"Collecting {N} item(s) nearby"` or `"No dropped items found nearby"`

**Side effect:** Sets `activeTask = { kind: 'collect', itemName, range }`

---

## rejoin_server

Disconnects ClaudeBot and reconnects. Use when game state is corrupted or the bot is stuck. The bot reconnects automatically after 5 seconds via the `end` event handler.

**Inputs:** none

**Returns:** `"Rejoining server..."`

**Side effect:** Calls `bot.quit()`. The bot's `end` event fires, which resets state and schedules `createBot()` after 5s.
