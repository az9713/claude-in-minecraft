# Crafting and building

Two tools extend ClaudeBot beyond mining into crafting and placement: `craft_item` turns raw materials in the bot's inventory into finished items, and `place_block` positions blocks in the world at specified coordinates.

---

## craft_item

### What it does

`craft_item` crafts any vanilla Minecraft item that has a recipe matching the bot's current inventory. It handles both 2×2 inventory crafting (sticks, crafting tables, planks) and 3×3 crafting table recipes (tools, armor, chests) — automatically navigating to a nearby crafting table when needed.

### How it works

1. Looks up the target item in `bot.registry.itemsByName[itemName]` to get its numeric ID. Returns an error if the item name is not a valid Minecraft item ID.
2. Calls `bot.recipesFor(item.id, null, 1, null)` — the final `null` means "no crafting table required". Mineflayer cross-checks this against the bot's current inventory to find recipes where every ingredient is available.
3. **If a recipe is found** with just the 2×2 grid: calls `bot.craft(recipe, count, null)` directly.
4. **If no 2×2 recipe exists:** searches for a crafting table block within 32 blocks using `bot.findBlock()`. Navigates to within 2 blocks of it using `GoalNear`. Then calls `bot.recipesFor` again with the crafting table block as the fourth argument — this unlocks 3×3 recipes. Calls `bot.craft(recipe, count, craftingTable)`.
5. Returns success or an error describing what failed (unknown item, no reachable crafting table, missing ingredients).

### The `bot.craft` signature

The argument order is `craft(recipe, count, craftingTable)` — count is second, table is third. This is different from what you might expect. The tool passes them in this order correctly.

### Ingredient checking

`bot.recipesFor` filters by available ingredients automatically. If you ask for `wooden_pickaxe` but only have one oak log (needing three planks), it returns an empty array and `craft_item` reports "No recipe available... (missing ingredients?)".

### Crafting table navigation

The crafting table search radius is 32 blocks. If no crafting table exists within that radius, `craft_item` fails with a clear message. To craft 3×3 recipes without an existing table: first craft a crafting table (`@claude craft a crafting_table`), then place it (`@claude place crafting_table at X Y Z`), then craft the target item.

---

## place_block

### What it does

`place_block` equips a block from inventory and places it at a specified world position. Placement requires an adjacent solid block to place against — exactly how a player places blocks in the Minecraft client.

### How it works

1. Locates the item in inventory by name using `bot.inventory.findInventoryItem(blockName, null, false)`.
2. Navigates within 3 blocks of the target coordinates using `GoalNear(..., 3)`.
3. Equips the item to the main hand with `bot.equip(item, 'hand')`.
4. Probes all six adjacent positions (below, above, east, west, south, north) to find a solid block that can serve as a placement reference:

```
faces = [
  below  → place on top face    (y-1 reference, faceVec {y:+1})
  above  → place on bottom face (y+1 reference, faceVec {y:-1})
  +x     → place on west face   (x+1 reference, faceVec {x:-1})
  -x     → place on east face   (x-1 reference, faceVec {x:+1})
  +z     → place on north face  (z+1 reference, faceVec {z:-1})
  -z     → place on south face  (z-1 reference, faceVec {z:+1})
]
```

5. For each solid adjacent block found, calls `bot.placeBlock(refBlock, faceVector)`. If the placement succeeds, returns success. If Mineflayer throws (line of sight failed, block occupied), tries the next face.
6. If no face succeeds, returns an error. This usually means all adjacent positions are air (floating in mid-air) or the bot can't reach a valid placement angle.

### Face vectors

Mineflayer's `placeBlock(referenceBlock, faceVector)` interprets `faceVector` as the direction from the reference block toward the new block's position. A plain JavaScript object `{ x: 0, y: 1, z: 0 }` is accepted — no special Vec3 import required.

---

## Interaction with other subsystems

- **Pathfinder:** Both tools call `bot.pathfinder.goto()` to navigate to the crafting table or placement site. This is a blocking `await` — the tool doesn't return until navigation completes or fails.
- **Inventory:** `craft_item` checks ingredients via mineflayer's recipe system; `place_block` checks inventory with `findInventoryItem`. Both fail early with a clear message if the required items are absent.
- **State:** Neither tool sets `state.activeTask` — they run synchronously to completion within the MCP tool call and leave the bot idle afterward.

---

## Common gotchas

**`craft_item` reports "unknown item":** Item names use Minecraft's internal registry IDs (snake_case), not display names. Use `oak_planks` not `"Oak Planks"`, `stone_pickaxe` not `"Stone Pickaxe"`. Check `get_nearby_blocks` or a Minecraft wiki for exact IDs.

**Crafting table not found:** The bot searches 32 blocks in all directions. If the table is further away, navigate to it manually first (`@claude come to X Y Z`), then issue the craft command.

**`place_block` reports "no adjacent solid block":** The target position is surrounded by air. Place blocks on existing surfaces — on the ground, on a wall, or on top of an existing block. You cannot place a block floating in mid-air.

**Block placed on the wrong face:** When multiple adjacent blocks exist, `place_block` tries faces in order (below, above, ±x, ±z) and uses the first that succeeds. If precise orientation matters (e.g., a log's grain direction), the current tool does not support specifying the face.

**`craft_item` says "missing ingredients" but you have the materials:** Some items have multiple recipes. `bot.recipesFor` returns all recipes that can be satisfied with current inventory. If a recipe exists but requires a specific arrangement of materials that your inventory doesn't satisfy (e.g., a shaped recipe), it won't appear. Check that you have the exact materials in the required quantities.
