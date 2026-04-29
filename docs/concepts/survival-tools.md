# Survival tools

Two tools manage ClaudeBot's basic survival needs: `eat_food` restores hunger, and `drop_item` discards unwanted inventory items. Neither runs as a background task — both complete synchronously within the MCP tool call.

---

## eat_food

### What it does

Equips a food item from inventory and consumes it, restoring hunger points. Optionally auto-selects the highest-quality food available.

### How it works

1. Checks `bot.food`. If it is already 20 (full), returns immediately — `bot.consume()` would throw in this case.
2. If `foodName` was specified, calls `bot.inventory.findInventoryItem(foodName, null, false)` to locate that specific item. Returns an error if not in inventory.
3. If no `foodName` was given, iterates a priority list of common food names from best to worst quality and stops at the first item found:

```js
FOOD_PRIORITY = [
  'enchanted_golden_apple', 'golden_carrot', 'golden_apple',
  'cooked_porkchop', 'cooked_beef', 'cooked_mutton', 'cooked_salmon',
  'cooked_chicken', 'cooked_rabbit', 'cooked_cod', 'rabbit_stew',
  'mushroom_stew', 'suspicious_stew', 'pumpkin_pie', 'bread',
  'baked_potato', 'melon_slice', 'apple', 'carrot', 'dried_kelp',
  'sweet_berries', 'glow_berries', 'beef', 'porkchop', 'mutton',
  'chicken', 'salmon', 'cod', 'rabbit', 'rotten_flesh', 'spider_eye',
]
```

4. Calls `bot.equip(item, 'hand')` to move the food to the active hotbar slot.
5. Calls `bot.consume()`, which holds the right-click button until the eating animation completes (~1.6 seconds in-game). Returns the post-eat food level.

### Food quality ranking

The priority list is ordered by `effectiveQuality = foodPoints + saturation` (from Minecraft's `1.21.11/foods.json`). Enchanted golden apples rank first because of their status effects; golden carrots rank second despite lower food points because of their exceptional saturation.

### When to use

Claude will call `eat_food` proactively when food drops below 10/20 (as stated in the agent prompt). You can also trigger it manually: `@claude eat some food` or `@claude eat bread`.

---

## drop_item

### What it does

Drops a specified quantity of an item from inventory onto the ground at ClaudeBot's feet as a dropped item entity.

### How it works

1. Calls `bot.inventory.findInventoryItem(itemName, null, false)` to locate the item by name.
2. If not found, returns an error.
3. Uses `count ?? item.count` — if no count is given, drops the entire stack.
4. Calls `bot.toss(item.type, null, dropCount)`, where `item.type` is the numeric Minecraft item ID. `toss` opens the inventory window internally, clicks the item slot to pick it up, then clicks outside the window to throw it.

### Use cases

- **Clearing inventory:** Drop junk items (cobblestone, gravel, dirt) to make room for valuable drops.
- **Trading:** Drop items on the ground for another player to pick up.
- **Quantity control:** Drop excess items when you've mined more than needed.

---

## Interaction with other subsystems

- **Inventory state:** Both tools read the live inventory via mineflayer's inventory API. `eat_food` and `drop_item` do not set `state.activeTask` — the bot remains idle during and after execution.
- **`bot.consume()` behavior:** Mineflayer's consume function holds right-click internally and resolves when the eating animation finishes. This takes ~1.6 seconds real time, during which the MCP tool call blocks.
- **Food level on the dashboard:** The dashboard's Food bar updates from the periodic status push (every 2 seconds). After `eat_food` completes, the bar will update within 2 seconds.

---

## Common gotchas

**"Already full (20/20 food)":** `eat_food` checks the current food level before trying to eat. Mineflayer's `consume()` throws if food is full and the game mode is not creative. The check prevents that error.

**"No food items in inventory":** The bot has no items matching the `FOOD_PRIORITY` list. Mine or receive food items first. If you have non-standard food (custom server items, modded items), specify the exact item name explicitly: `@claude eat suspicious_stew`.

**"Eat failed: Food is full":** This can happen if food reaches 20 between the initial check and the `consume()` call — rare in practice but possible if the bot was regenerating health during the call. Retry once; if persistent, the bot is genuinely full.

**`drop_item` drops wrong quantity:** If you drop more than one stack (e.g., `count: 100` but only 64 in inventory), `bot.toss` drops what's available and does not throw. To drop partial stacks, specify an exact count.

**Dropped items despawn:** Items dropped on the ground despawn after 5 minutes if uncollected (standard Minecraft behavior). If you drop items for another player to collect, make sure they pick them up promptly.
