# MCP tools reference

All 20 tools exposed by `bot/mcp-server.js`. Claude discovers these at session start via `tools/list` and calls them to act in the game.

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

---

## craft_item

Crafts an item using inventory materials. Tries the 2×2 inventory grid first; if the recipe requires a crafting table, navigates to the nearest one (within 32 blocks) and opens it.

**Inputs:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `itemName` | string | yes | — | Minecraft item ID, e.g. `oak_planks`, `wooden_pickaxe`, `torch` |
| `count` | integer | no | 1 | Number of items to craft |

**Returns:** `"Crafted {count}x {itemName}"` on success.

**Error cases:**
- `"Unknown item: {itemName}"` — not a valid Minecraft item ID
- `"No 2x2 recipe found for {itemName} and no crafting table nearby"` — 3×3 recipe needed but no table within 32 blocks
- `"No recipe available for {itemName} (missing ingredients?)"` — recipe exists but ingredients are not in inventory
- `"Craft failed: {error}"` — mineflayer-level failure (e.g., crafting table window could not open)

**Side effect:** May navigate the bot to a crafting table. Does not set `activeTask` — completes synchronously.

> **Note:** Item names use Minecraft registry IDs (snake_case): `wooden_pickaxe` not `"Wooden Pickaxe"`, `oak_planks` not `"Oak Planks"`.

---

## place_block

Places a block from inventory at the specified world coordinates by finding a solid adjacent block to place against.

**Inputs:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `blockName` | string | yes | Block item name in inventory, e.g. `dirt`, `cobblestone`, `oak_log` |
| `x` | number | yes | Target X coordinate |
| `y` | number | yes | Target Y coordinate |
| `z` | number | yes | Target Z coordinate |

**Returns:** `"Placed {blockName} at {x} {y} {z}"` on success.

**Error cases:**
- `"{blockName} not in inventory"` — item not found in inventory
- `"Cannot reach position: {error}"` — pathfinder could not navigate to within 3 blocks
- `"Cannot place {blockName}: no adjacent solid block at {x} {y} {z}"` — all six adjacent positions are air

**Side effect:** Navigates the bot to within 3 blocks of the target. Does not set `activeTask`.

---

## eat_food

Equips and consumes a food item to restore hunger. Auto-selects the highest-quality food in inventory if no name is given.

**Inputs:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `foodName` | string | no | Specific food item name. Omit to auto-pick best available. |

**Returns:** `"Ate {itemName}, food now {N}/20"` on success.

**Error cases:**
- `"Already full (20/20 food)"` — food level is 20, no eating needed
- `"{foodName} not in inventory"` — specified food not found
- `"No food items in inventory"` — inventory contains nothing in the known food list
- `"Eat failed: {error}"` — mineflayer consume error

**Side effect:** Moves a food item to the hotbar. Takes ~1.6 seconds for the eating animation. Does not set `activeTask`.

---

## drop_item

Drops items from inventory onto the ground at ClaudeBot's current position.

**Inputs:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `itemName` | string | yes | — | Item name to drop, e.g. `dirt`, `cobblestone` |
| `count` | integer | no | entire stack | How many to drop |

**Returns:** `"Dropped {count}x {itemName}"`

**Error cases:**
- `"{itemName} not in inventory"` — item not found
- `"Drop failed: {error}"` — mineflayer toss error

**Side effect:** Item entities appear on the ground near the bot. Does not set `activeTask`.

---

## attack_entity

Attacks a nearby entity by name or type until it is defeated or leaves range. Runs as a persistent background task via the tick loop.

**Inputs:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `targetName` | string | yes | — | Partial, case-insensitive match against entity name (e.g. `zombie`, `skeleton`, `cow`) |
| `range` | number | no | 20 | Search radius in blocks |

**Returns:** `"Attacking {targetName} (id {entityId})"` if a target is found.

**Error cases:**
- `"No {targetName} found within {range} blocks"` — no matching entity in range

**Side effect:** Sets `activeTask = { kind: 'attack', targetName, range, targetId }`. The tick loop then chases and attacks the target every 500ms until it is gone, then announces defeat and resets to idle.

> **Note:** Use `stop_action` to abort combat before the target is defeated.

---

## save_waypoint

Saves ClaudeBot's current position as a named waypoint in `bot/waypoints.json`.

**Inputs:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Waypoint name, e.g. `base`, `mine`, `farm` (lowercased on save) |

**Returns:** `"Saved \"{name}\" at {x} {y} {z}"`

**Side effect:** Writes to `bot/waypoints.json`. Creates the file if it doesn't exist.

---

## goto_waypoint

Navigates ClaudeBot to a previously saved waypoint.

**Inputs:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Waypoint name to travel to (case-insensitive) |

**Returns:** `"Navigating to \"{name}\" at {x} {y} {z}"`

**Error cases:**
- `"Unknown waypoint \"{name}\". Known: {list}"` — name not found in `bot/waypoints.json`

**Side effect:** Sets `activeTask = { kind: 'navigate', x, y, z }`, calls `bot.pathfinder.setGoal(GoalNear(..., 2))`.

---

## list_waypoints

Lists all saved waypoints and their coordinates.

**Inputs:** none

**Returns:** One `name: x y z` line per waypoint, or `"No waypoints saved yet"`.

---

## delete_waypoint

Removes a named waypoint from `bot/waypoints.json`.

**Inputs:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Waypoint name to remove (case-insensitive) |

**Returns:** `"Deleted waypoint \"{name}\""`

**Error cases:**
- `"Waypoint \"{name}\" not found"` — name not in file
