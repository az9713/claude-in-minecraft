# The attack task

ClaudeBot can engage and defeat hostile mobs (or any entity) autonomously using the `attack_entity` tool. Combat runs as a persistent background task — ClaudeBot chases the target and attacks it every 500ms until the entity is gone.

---

## What it solves

Before combat support was added, ClaudeBot had no way to interact with mobs. If a zombie walked toward you, the bot stood still. With `attack_entity`, you can order ClaudeBot to clear an area of mobs, defend a position, or hunt specific animals — without keeping your Minecraft client open.

---

## How it works

### Starting a fight

When Claude calls `attack_entity`, the tool:

1. Searches `bot.entities` for any entity whose name (username, displayName, or `name` property) partially matches `targetName`, within the specified `range`.
2. If found, sets `state.activeTask = { kind: 'attack', targetName, range, targetId: entity.id }`.
3. Returns immediately — fighting happens in the background tick loop.

### The tick loop (every 500ms)

`executeAttackTask` in `bot/index.js` runs on every tick while `activeTask.kind === 'attack'`:

1. Looks up the entity by `task.targetId` in `bot.entities` (O(1) map lookup).
2. If the entity is gone from `bot.entities` (died or despawned), announces defeat in chat and resets to idle.
3. If the entity is still present but beyond 3 blocks, sets a `GoalFollow(target, 2)` pathfinder goal to close the distance.
4. If within 3 blocks, clears the pathfinder goal and calls `bot.attack(entity)`.

`bot.attack()` sends a single swing packet. Mineflayer respects the game's attack cooldown automatically — calling it faster than the cooldown has no effect, but the 500ms tick interval approximates one swing per second for most tools.

### Entity tracking across ticks

When the bot first spots a target, the entity's numeric ID is stored in `task.targetId`. On subsequent ticks, the ID is used for fast lookup rather than scanning all entities by name. If the stored ID is gone (entity died or chunks unloaded), the tick loop does a fresh name-scan within range. This handles cases where a mob despawns and a different mob of the same type appears nearby.

### Stopping combat

Combat stops automatically when no matching entity exists within range. You can also stop it manually with `stop_action` (or `@claude stop`), which resets `activeTask` to idle and clears the pathfinder goal.

---

## Key data structures

```js
// activeTask while attacking
state.activeTask = {
  kind: 'attack',
  targetName: 'zombie',   // partial-match string used for name scan
  range: 20,              // search radius in blocks
  targetId: 142,          // mineflayer entity ID for fast lookup
  busy: false,            // prevents re-entrant async execution
}
```

---

## Interaction with other subsystems

- **Pathfinder:** Combat uses `GoalFollow` to chase moving targets — the same goal type used by `follow_player`. The follow goal is updated every 500ms as the entity moves.
- **Dashboard:** While `activeTask.kind === 'attack'`, the dashboard task badge shows "attack" in red.
- **Other tasks:** `attack_entity` replaces any current task (`mine`, `follow`, `collect`, etc.) by overwriting `state.activeTask`.

---

## Configuration and limits

| Parameter | Default | Notes |
|-----------|---------|-------|
| `targetName` | required | Partial, case-insensitive match against entity name |
| `range` | 20 blocks | Search radius for initial detection and re-scan |
| Attack range | 3 blocks | Hard-coded; mineflayer's effective melee reach |
| Tick rate | 500ms | Inherited from the shared tick loop |

---

## Common gotchas

**ClaudeBot gets killed while fighting:** If the server is not set to peaceful difficulty, fighting hostile mobs means ClaudeBot can take damage. ClaudeBot does not currently dodge attacks or equip armor. For risky fights, ensure it has a good weapon in its hotbar and full health first.

**"No zombie found within 20 blocks":** The entity must be in loaded chunks, within range, and its internal name must match your search string. Check `get_nearby_entities` first to see what names mineflayer reports for mobs in your area.

**ClaudeBot attacks passive animals:** `targetName` is a partial substring match. `@claude attack cow` will match both `cow` and `mooshroom` (whose internal name contains "mushroom", not "cow") — but it will also correctly match a plain cow. If you want precision, use the exact internal name as returned by `get_nearby_entities`.

**Fighting stops mid-combat without announcement:** The entity moved out of the search range (default 20 blocks). The tick loop only scans within `task.range`. Increase range when chasing fast mobs.
