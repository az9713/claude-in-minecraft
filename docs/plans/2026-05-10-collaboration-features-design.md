# Collaboration Features Design

**Date:** 2026-05-10
**Status:** Approved, ready for implementation

## Goal

Add three collaboration features that let ClaudeBot work alongside the player naturally. Mode switching is inferred from player activity — no explicit mode command required. Each feature ships independently with its own inference heuristic.

---

## Feature 1: Co-mine

### What it does
When the player starts breaking blocks, the bot detects it, pathfinds to within 3 blocks, and mines the same block type in the surrounding area — doubling throughput without being asked.

### Implementation
- Listen on `bot.on('blockBreakProgressObserved', (breaker, block))`, filter for the player entity.
- On trigger: set `activeTask = { kind: 'comine', blockType: block.name, playerEntity }`.
- Tick loop: find nearest matching block within 6 blocks of the player → dig → repeat.
- Stop if player hasn't mined for 5 seconds, or player moves > 20 blocks away.

### Inference heuristic
Fires when player breaks 2+ blocks of the same type within 10 seconds. Single-block interactions (torches, chests) do not trigger it.

### Edge cases
- Never mines within 1 block of player position (no underfoot griefing).
- Stops and idles if player teleports > 20 blocks away.

### New MCP tool
`co_mine` — manually trigger co-mine for a specific block type.

---

## Feature 2: Guardian

### What it does
Bot watches the player's health and nearby hostile mobs. When the player takes damage or a mob gets close, the bot rushes in to attack without being asked.

### Implementation
- In the 500ms tick loop, check `bot.players[username]?.entity` for player position.
- **Proximity trigger:** hostile mob within 12 blocks of the player → bot targets it.
- **Damage trigger:** `bot.on('entityHurt', entity)` — if entity is the player, find and attack the nearest mob.
- Reuses existing `executeAttackTask` + `GoalFollow` logic.
- After mob is dead, bot returns to passively follow the player.

### Inference heuristic
Always-on by default. Player opts out via `guard_player disable`, not in.

### Edge cases
- Creepers within 4 blocks: bot pulls back rather than engaging (explosion risk).
- Skeletons prioritized over zombies (ranged damage threat).

### New MCP tool
`guard_player` — enable or disable guardian mode explicitly.

---

## Feature 3: Supply Runner

### What it does
Bot acts as a mobile mule. Player drops overflowing items on the ground, bot collects them, walks to a saved storage waypoint, deposits into a chest, then returns to the player.

### Implementation
- `bot.on('entitySpawn', entity)` — if entity type is `item` and within 8 blocks, pathfind to collect it after a 2-second grace period.
- After collecting, navigate to the `storage` waypoint → `bot.openChest` → `chest.deposit()` for each stack → close → return to player.
- If no `storage` waypoint exists, bot holds the items and reports via chat.

### Inference heuristic
Auto-collects dropped items only when within 8 blocks and item has been on ground 2+ seconds (avoids scooping accidental drops mid-swing).

### Limitation
Mineflayer cannot read another player's inventory. The player must drop items manually. Shortcut: `@claude I'm full` prompts the player to drop items and triggers a collection run.

### New MCP tools
- `set_storage` — saves current position as the designated chest/storage waypoint.
- `deposit_items` — manually triggers a storage run to the `storage` waypoint.
- `mule_status` — reports what the bot is currently carrying on behalf of the player.

---

## Implementation Order

1. Guardian (reuses most existing code — lowest risk)
2. Co-mine (new tick loop branch + event listener)
3. Supply runner (new event listener + chest interaction)

## Files to change

| File | Change |
|------|--------|
| `bot/tools/combat.js` | Add `guard_player` tool |
| `bot/tools/world.js` | Add `co_mine` tool |
| `bot/tools/inventory.js` | Add `set_storage`, `deposit_items`, `mule_status` tools |
| `bot/index.js` | Add `comine` and `guardian` branches to tick loop; add `entitySpawn` listener |
| `bot/mcp-server.js` | No changes needed (tools auto-register via existing pattern) |
| `agent/prompt.md` | Document new tools for Claude |
