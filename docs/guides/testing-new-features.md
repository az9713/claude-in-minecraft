# Test the new features

Step-by-step verification for all five feature groups added in April 2026: combat, crafting, building, waypoints, and survival tools. Each section is independent — test them in any order.

---

## Prerequisites

All three components must be running before testing:

- **Terminal 1:** Paper server (`bash server/start.sh`) — wait for `Done!`
- **Terminal 2:** Bot process (`node bot/index.js`) — wait for `[Bot] Spawned in world`
- **Terminal 3:** Agent runner (`bash agent/run.sh`) — wait for `ClaudeBot runner started`

The server must be in **survival mode** with **peaceful difficulty** for the crafting and combat tests. Verify in `server/server.properties`:

```
gamemode=survival
force-gamemode=true
difficulty=peaceful
```

For the combat test only, temporarily change to:

```
difficulty=easy
```

Then restart the server for the difficulty change to take effect.

---

## 1. Waypoints

Waypoints are the safest starting point — no mobs, no materials required.

**Step 1:** Stand anywhere in the world. Type in game chat:

```
@claude save waypoint testbase
```

**Expected reply:**

```
ClaudeBot: Saved "testbase" at X Y Z
```

Where X, Y, Z are ClaudeBot's current coordinates. Open the dashboard at `http://127.0.0.1:8889` and confirm the Waypoints panel shows `testbase` with those coordinates.

**Step 2:** Move far away (fly or walk at least 30 blocks). Type:

```
@claude list waypoints
```

**Expected reply:**

```
ClaudeBot: testbase: X Y Z
```

**Step 3:** Ask ClaudeBot to navigate to the waypoint:

```
@claude go to waypoint testbase
```

**Expected:** The dashboard task badge switches to "navigate". ClaudeBot walks toward the saved coordinates. When it arrives, the badge returns to "idle".

**Step 4:** Verify deletion:

```
@claude delete waypoint testbase
```

**Expected reply:**

```
ClaudeBot: Deleted waypoint "testbase"
```

The dashboard Waypoints panel should now be empty within 5 seconds.

**Verify the file:** Check `bot/waypoints.json`. After step 1, it should exist with the entry. After step 4, it should be `{}`.

---

## 2. Survival tools (eat_food and drop_item)

**Prerequisites:** A food item in ClaudeBot's inventory. Give the bot some bread by dropping it on the ground near ClaudeBot (or use `/give ClaudeBot bread 5`).

### eat_food

**Step 1:** Reduce ClaudeBot's food level to below 20. In survival mode with movement, food depletes naturally — or use `/effect give ClaudeBot hunger 5 5` to drain it instantly.

**Step 2:** Type:

```
@claude eat some food
```

**Expected reply (food was below 20):**

```
ClaudeBot: Ate bread, food now 18/20
```

(Exact food value depends on what was eaten and starting hunger.)

**Step 3:** Test the "already full" guard — if food is 20:

```
@claude eat some food
```

**Expected reply:**

```
ClaudeBot: Already full (20/20 food)
```

**Step 4:** Test specific food name:

```
@claude eat bread
```

**Expected:** Either eats the bread if hungry, or reports full. If bread is not in inventory, reports `bread not in inventory`.

### drop_item

**Step 1:** Verify ClaudeBot has items. Check with:

```
@claude what is in your inventory
```

**Step 2:** Drop a partial count:

```
@claude drop 2 bread
```

**Expected reply:**

```
ClaudeBot: Dropped 2x bread
```

Two bread item entities should appear on the ground near ClaudeBot. Verify by walking over them to pick them up.

**Step 3:** Drop an entire stack without specifying count:

```
@claude drop all cobblestone
```

**Expected:** Drops however many cobblestone ClaudeBot holds.

**Step 4:** Test missing item:

```
@claude drop diamond
```

**Expected reply (no diamonds in inventory):**

```
ClaudeBot: diamond not in inventory
```

---

## 3. Crafting

**Prerequisites:** ClaudeBot must have wood logs in inventory. Mine some if needed:

```
@claude mine 3 oak_log
```

### 2×2 crafting (no table needed)

**Step 1:** Craft planks from logs:

```
@claude craft oak_planks
```

**Expected reply:**

```
ClaudeBot: Crafted 1x oak_planks
```

Verify by checking inventory:

```
@claude what is in your inventory
```

Should show `oak_planks x4` (one log → four planks).

**Step 2:** Craft sticks:

```
@claude craft 4 stick
```

**Expected:** `Crafted 4x stick` (uses planks already in inventory; count 4 means craft 4 batches, yielding 16 sticks).

**Step 3:** Craft a crafting table:

```
@claude craft crafting_table
```

**Expected:** `Crafted 1x crafting_table`

### 3×3 crafting (requires a crafting table in the world)

**Step 1:** Place the crafting table using `place_block` (or place it yourself in-game). Ensure ClaudeBot is within 32 blocks of the table.

**Step 2:** Craft a wooden pickaxe:

```
@claude craft wooden_pickaxe
```

**Expected:** ClaudeBot navigates to the crafting table, then replies:

```
ClaudeBot: Crafted 1x wooden_pickaxe
```

If no crafting table is found within 32 blocks, ClaudeBot reports:

```
ClaudeBot: No 2x2 recipe found for wooden_pickaxe and no crafting table nearby
```

**Step 3:** Test the "missing ingredients" error. With no planks in inventory, try:

```
@claude craft oak_planks
```

**Expected:** `No recipe available for oak_planks (missing ingredients?)`

---

## 4. Building (place_block)

**Prerequisites:** ClaudeBot must have a placeable block in inventory (dirt, cobblestone, sand, etc.).

**Step 1:** Choose a target position. Stand near a flat surface. Note the coordinates of the block one above the ground (press F3 in the client). Say the ground surface is at Y=63 — the target position for placing a block on top of it is Y=64.

**Step 2:** Give ClaudeBot some dirt if it doesn't have any:

```
/give ClaudeBot dirt 5
```

**Step 3:** Ask ClaudeBot to place a block:

```
@claude place dirt at -9 64 -52
```

**Expected reply:**

```
ClaudeBot: Placed dirt at -9 64 -52
```

Walk to those coordinates and confirm the dirt block exists in the world.

**Step 4:** Test the "no adjacent block" error. Choose a coordinate floating in mid-air (surrounded by air on all sides):

```
@claude place dirt at 0 200 0
```

**Expected:**

```
ClaudeBot: Cannot place dirt: no adjacent solid block at 0 200 0
```

(Unless blocks happen to exist adjacent to that position in your world.)

---

## 5. Combat

> **Warning:** This test requires changing the server difficulty from peaceful to easy. Hostile mobs will spawn and attack players. Set difficulty back to peaceful after testing.

**Step 1:** Change difficulty to easy in `server/server.properties`:

```
difficulty=easy
```

Restart the server. Wait for a zombie or skeleton to spawn near ClaudeBot (or use `/summon zombie` if you have OP).

**Step 2:** Check for nearby mobs:

```
@claude what do you see around you
```

**Expected:** ClaudeBot reports nearby entities including a mob type name.

**Step 3:** Issue the attack command:

```
@claude attack the zombie
```

**Expected reply:**

```
ClaudeBot: Attacking zombie
```

The dashboard task badge turns red and shows "attack". ClaudeBot pathfinds toward the zombie and begins swinging every 500ms.

**Step 4:** Observe the fight. When the zombie is dead, ClaudeBot announces in chat:

```
ClaudeBot: zombie defeated!
```

The task badge returns to "idle".

**Step 5:** Test "no target found":

```
@claude attack dragon
```

(Assuming no Ender Dragon is present.)

**Expected:**

```
ClaudeBot: No dragon found within 20 blocks
```

**Step 6:** Test manual stop mid-combat. Summon another zombie, start combat, then immediately:

```
@claude stop
```

**Expected:** ClaudeBot stops moving. Task badge returns to idle. The zombie remains alive.

**Step 7:** Restore peaceful difficulty:

```
difficulty=peaceful
```

Restart the server.

---

## Confirming all new tools are registered

The MCP server exposes a `tools/list` endpoint. Verify all 20 tools are discoverable:

```bash
curl -s -X POST http://127.0.0.1:8888/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0"}},"id":1}' \
  | grep -o '"name":"[^"]*"'
```

> **Tip:** The output includes the session ID in response headers. For the full tools list, run a follow-up `tools/list` call with that session ID. The smoke test (`node test/smoke-test.js`) confirms end-to-end tool dispatch works without manual curl steps.

Expected tool names (20 total):

```
get_status, send_chat, navigate_to, follow_player, stop_action, rejoin_server,
mine_block, get_nearby_blocks, get_nearby_entities, craft_item, place_block,
get_inventory, collect_nearby_items, eat_food, drop_item,
attack_entity,
save_waypoint, goto_waypoint, list_waypoints, delete_waypoint
```
