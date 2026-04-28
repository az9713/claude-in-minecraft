# ADR 003: Survival gamemode + peaceful difficulty

**Status:** Accepted

## Context

The Minecraft server gamemode and difficulty settings interact in non-obvious ways and significantly affect how ClaudeBot behaves.

Two requirements were in tension:

1. **Items must drop when blocks are mined.** In creative mode, `bot.dig()` breaks blocks but items never drop to inventory. Claude calling `mine_block` would report success but inventory would always be empty.

2. **ClaudeBot must not die while idle.** Between commands, ClaudeBot stands in the open world. Without intervention, zombies and skeletons kill it at night. Repeated death causes the bot to cycle in a respawn loop, never staying connected long enough to be useful.

The initial attempt to solve problem 2 by switching to creative mode broke problem 1. Several hours of debugging confirmed the root cause: `bot.inventory.items()` always returns `[]` in creative mode regardless of what was mined.

## Decision

**Survival mode** (`gamemode=survival`) with **peaceful difficulty** (`difficulty=peaceful`) and **forced gamemode** (`force-gamemode=true`).

Additionally, `bot.on('death', () => bot.respawn())` was added as a safety net.

## Alternatives considered

### Creative mode
Blocks the item drop mechanic entirely. Rejected after confirmation that `bot.inventory.items()` returns empty even after successful `bot.dig()` calls in creative.

### Survival mode + easy difficulty
Hostile mobs spawn and attack. ClaudeBot dies while idle (confirmed: killed by zombie and creeper during testing). Required constant manual intervention. Rejected.

### Survival mode + peaceful difficulty (chosen)
Peaceful removes hostile mob spawns. Passive mobs (sheep, cows, pigs) still spawn. Item drops from mining work correctly. ClaudeBot can survive indefinitely while idle.

### Adventure mode
Cannot break blocks at all (`bot.dig()` fails). Rejected immediately.

### Plugin-based mob protection
Would require a Bukkit plugin to mark ClaudeBot as invulnerable. Added complexity without benefit over peaceful difficulty. Rejected.

## Rationale

Peaceful + survival is the only combination that satisfies both requirements with no code changes. It's a server configuration change, not a code change, which means it's simple and reliable.

`force-gamemode=true` is required because without it, if ClaudeBot's player data file records a previous creative mode session, it will join in creative regardless of the server default. This was the cause of a multi-hour debugging session where gamemode appeared to be survival in `server.properties` but the bot was actually in creative.

## Trade-offs

- Peaceful removes all hostile mobs for all players on the server. If the human player wants to fight mobs, they need to change difficulty. This is acceptable for a development/demo server.
- If someone wants hostile mobs AND a ClaudeBot companion, they would need to use a plugin to grant ClaudeBot invulnerability instead.

## Consequences

- Any new player or bot connecting to the server will join in survival mode (force-gamemode=true), which may be unexpected for the human player who may prefer creative for flying. They can override with `/gamemode creative` after joining if they have operator permissions.
- The human player needs operator (OP) level 4 permissions to use `/gamemode` — added to `server/ops.json`.
- The auto-respawn handler (`bot.on('death', () => bot.respawn())`) remains in the codebase as a safety net for edge cases (fall damage, player-inflicted damage, etc.) even though peaceful mode makes death unlikely.
