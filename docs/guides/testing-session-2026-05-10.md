# Testing session retrospective — 2026-05-10

First full live testing session for the three new collaboration features: Guardian, Co-mine, and Supply Runner. This document records every friction point encountered, how each was resolved, and the bugs discovered and fixed during the session.

---

## Session overview

**Duration:** ~3 hours  
**Tester:** az9713 (Simon)  
**Environment:** Windows 11, Minecraft Java Edition 1.21.11, ClaudeBot on local Paper server  
**Features tested:** Guardian, Co-mine, Supply Runner  
**Outcome:** All three features confirmed working. Five bugs fixed. Seven UX improvements shipped during the session.

---

## Feature 1: Guardian

### What was tested
Spawn a zombie near ClaudeBot and verify it auto-attacks without a command.

### Result
**Working.** ClaudeBot said `Defending from zombie!` and killed it. ClaudeBot also earned the Minecraft "Monster Hunter" advancement.

### Frictions encountered

**Friction 1 — `/gamerule doDaylightCycle false` was rejected**

The command appeared to fail. Root cause: the user was typing `/gamerule doDaylightCycle false` with spaces incorrectly, and the server was responding with `Incorrect argument`. The command itself was correct; the typing was not.

Resolution: user typed the full string correctly and it worked. Not a bug.

---

**Friction 2 — `/summon zombie` typed in the dashboard, not in Minecraft**

The user typed `/summon zombie ~ ~ ~` into the dashboard web UI at `http://127.0.0.1:8889`. The dashboard routes everything to ClaudeBot as an `@claude` command. ClaudeBot received it and replied `No zombie spotted nearby — I can't /summon`.

Resolution: explained that `/` commands must be typed inside the Minecraft game window (press **T**), not in the dashboard. The dashboard is only for `@claude` commands.

> **Rule to remember:** If it starts with `/` — type it in Minecraft. If it starts with `@claude` — type it in the dashboard or in Minecraft chat.

---

**Friction 3 — ClaudeBot died from zombie damage**

ClaudeBot was in survival with no armor and 20hp. After killing one zombie, the user summoned a second one immediately. ClaudeBot died.

Resolution: no code change needed. ClaudeBot auto-respawns. The session continued. Suggested the user wait between summons or restore peaceful before summoning again.

---

**Friction 4 — ClaudeBot health stayed critically low (0.3hp) after respawn**

Health regenerates slowly in Minecraft — it requires full food bar and time. ClaudeBot had no food.

Resolution: user ran `/give ClaudeBot cooked_beef 10`, then `@claude eat some food`. ClaudeBot ate and food reached 20/20. Then `effect give ClaudeBot regeneration 30 5` in Terminal 1 finished the healing.

**Lesson learned:** ClaudeBot needs food before fighting. Document this in the guardian guide.

---

## Feature 2: Co-mine

### What was tested
Break 2+ blocks of the same type near ClaudeBot and verify it joins in automatically.

### Result
**Working after two bug fixes.** See bugs below.

### Frictions encountered

**Friction 5 — Co-mine didn't trigger in creative mode**

The user was in creative mode (as instructed for flying). In creative mode, blocks break instantly — there is no block-breaking animation. The co-mine inference was listening for `blockBreakProgressObserved`, which only fires when a block-breaking animation plays (survival mode only).

**Bug fix:** Replaced `blockBreakProgressObserved` with `blockUpdate`. The `blockUpdate` event fires whenever a block changes state — including instant breaks in creative mode. The new logic detects when a block turns to air near a player within 6 blocks.

```javascript
// Before (broken in creative mode)
bot.on('blockBreakProgressObserved', (block, destroyStage, entity) => { ... });

// After (works in both creative and survival)
bot.on('blockUpdate', (oldBlock, newBlock) => {
  if (!oldBlock || newBlock.type !== 0) return; // only care about blocks becoming air
  // find nearest player within 6 blocks of the broken block
  // trigger co-mine if 2+ same-type blocks broken within 10s
});
```

---

**Friction 6 — Guardian interrupted co-mine with a zombie attack**

The user was in the middle of testing co-mine when a previously summoned zombie (from Guardian testing) attacked. ClaudeBot switched from co-mine to attack, breaking the co-mine demo.

**Bug fix:** Added one line to `executeGuardianTick` — guardian now skips if the bot is already co-mining:

```javascript
function executeGuardianTick(bot, state) {
  if (!state.guardEnabled) return;
  if (state.activeTask.kind === 'attack') return;
  if (state.activeTask.kind === 'comine') return; // NEW — don't interrupt co-mining
```

---

**Friction 7 — User didn't know where to find stone blocks**

Spawn area terrain is mostly gravel, grass, and dirt. No obvious stone nearby. The user asked not to waste time searching.

Resolution: updated instructions to say co-mine works with any block type (dirt, grass, gravel). No code change.

---

**Friction 8 — "Hotbar" terminology not explained**

Instructions said "drag a pickaxe to your hotbar" — the user didn't know what a hotbar was.

Resolution: defined it as "the row of 9 boxes at the very bottom of your Minecraft screen." Added plain-language explanations to all instructions going forward.

---

## Feature 3: Supply Runner

### What was tested
Place a chest, register it as storage, drop items, verify auto-collect, then deposit.

### Result
**Working after two bug fixes.** See bugs below.

### Frictions encountered

**Friction 9 — ClaudeBot couldn't find the chest even when it was visible**

The user placed a chest and typed `@claude set storage here`. ClaudeBot saved its own position (e.g. `-3 64 26`). But ClaudeBot was not standing next to the chest — it was standing next to the user, who was 4 blocks away from the chest. When `deposit_items` ran, it searched within 3 blocks of `-3 64 26` and found nothing.

**Root bug:** `set_storage` saved ClaudeBot's position, not the chest's position. Any distance between ClaudeBot and the chest caused a mismatch.

**Bug fix:** Rewrote `set_storage` to find the nearest chest within 6 blocks and save the chest's actual coordinates:

```javascript
// Before — saved bot position (wrong)
state.storagePos = { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) };

// After — finds nearest chest and saves its position (correct)
const chestBlock = bot.findBlock({
  matching: (block) => block.name.includes('chest'),
  maxDistance: 6,
});
if (!chestBlock) return text('No chest found within 6 blocks. Place a chest nearby first.');
const { x, y, z } = chestBlock.position;
state.storagePos = { x, y, z };
```

---

**Friction 10 — `deposit_items` said "can't find chest" twice, then worked on third try**

The user ran `deposit_items` three times. The first two said "no chest found." The third worked.

Root cause: the first two calls used the old stale storage position. The third call was after `set_storage` was re-run with the fix above.

Not a separate bug — same root cause as Friction 9.

---

**Friction 11 — "Set storage here" needed ClaudeBot to be physically next to the chest**

Before the fix, the user needed to:
1. Stand next to the chest themselves
2. Teleport ClaudeBot to them
3. Not move
4. Type set_storage

This was confusing because any movement broke the setup.

After the fix, ClaudeBot searches a 6-block radius for any chest automatically. The user just needs a chest somewhere nearby — exact positioning doesn't matter.

---

**Friction 12 — No way to see chest contents without walking up to it**

The user asked if there was a command to query chest contents. There isn't — the bot can deposit but not read chests.

Resolution: explained that right-clicking the chest in Minecraft opens it visually. Added to backlog for a future `check_storage` tool.

---

## UX improvements shipped during the session

| Improvement | Why |
|---|---|
| Added `teleport_to_player` tool | Pathfinding was too slow and unreliable for the user to see ClaudeBot. Instant teleport via `/tp` command is reliable. |
| Added `op ClaudeBot` to `ops.json` | ClaudeBot needs OP to run `/tp`. This was missing from setup, causing `teleport_to_player` to silently fail. |
| Added OP instructions to `RESTART.md` | User had to manually run `op ClaudeBot` in Terminal 1. Now documented as a one-time setup step, and `ops.json` persists it automatically. |
| Fixed co-mine to work in creative mode | `blockUpdate` event replaces `blockBreakProgressObserved` — creative mode now supported. |
| Guardian won't interrupt co-mine | One-line fix: guardian skips when `activeTask.kind === 'comine'`. |
| `set_storage` saves chest coordinates | Saves the chest's own position, not the bot's position. Eliminates distance mismatch errors. |
| Dashboard health display | Directed user to `http://127.0.0.1:8889` for live health/position display instead of waiting 30s for `@claude get status`. |

---

## Bugs summary

| Bug | Symptom | Fix |
|---|---|---|
| Co-mine doesn't trigger in creative mode | Player breaks blocks, ClaudeBot ignores them | Switch from `blockBreakProgressObserved` to `blockUpdate` event |
| Guardian interrupts co-mine | Zombie spawned mid-co-mine, ClaudeBot stopped mining and attacked | Skip guardian tick when `activeTask.kind === 'comine'` |
| `set_storage` saves wrong position | Chest visible but ClaudeBot says "no chest found" | Save chest block coordinates, not bot position |
| `teleport_to_player` silently fails | ClaudeBot says "On my way!" but doesn't move | ClaudeBot was not OP'd; fixed by adding to `ops.json` |
| `findBlock` crashes with plain object | `pos.floored is not a function` error in `deposit_items` | Use function matcher in `findBlock` instead of `point:` option |

---

## Key lessons for future testing

**Always test in the player's actual game mode.** Creative mode breaks assumptions about how block events fire. Test both creative and survival.

**Terminology matters.** "Hotbar", "right-click to place", "left-click to mine" — none of these are obvious to someone who doesn't play Minecraft regularly. Instructions must spell out every action.

**The dashboard and Minecraft chat are separate systems.** Users will confuse them. Make the distinction explicit in every instruction set.

**30-second command latency is a significant UX problem.** Every `@claude` command goes through the AI pipeline. Users need to be told this upfront so they wait instead of re-sending commands.

**ClaudeBot needs food before combat.** Guardian demos should include a step to give ClaudeBot food before spawning mobs.

---

## See also

- [Common issues](../troubleshooting/common-issues.md) — updated with new failure modes from this session
- [Chat commands reference](../reference/chat-commands.md) — full list of `@claude` commands
- [RESTART.md](../../RESTART.md) — updated with OP setup step
