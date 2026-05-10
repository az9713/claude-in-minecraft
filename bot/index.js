import mineflayer from 'mineflayer';
import pathfinderPkg from 'mineflayer-pathfinder';
const { pathfinder, Movements, goals } = pathfinderPkg;
import { appendFileSync, writeFileSync, existsSync } from 'fs';
import { startMcpServer } from './mcp-server.js';
import { startDashboard, logBotChat, logPlayerChat } from './dashboard.js';

const { GoalFollow } = goals;

const CHAT_QUEUE = new URL('../bot/chat-queue.txt', import.meta.url).pathname.replace(/^\//, '');
const BOT_NAME = 'ClaudeBot';
const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = 25565;
const MC_VERSION = '1.21.11';

// Shared state passed to MCP tools
const state = {
  bot: null,
  activeTask: { kind: 'idle' },
  guardEnabled: true,   // guardian mode: on by default
  storagePos: null,     // supply runner storage location
};

const HOSTILE_MOBS = new Set([
  'zombie', 'skeleton', 'creeper', 'spider', 'cave_spider', 'witch',
  'enderman', 'blaze', 'ghast', 'slime', 'magma_cube', 'phantom',
  'drowned', 'husk', 'stray', 'pillager', 'ravager', 'vex', 'vindicator',
  'evoker', 'silverfish', 'endermite', 'guardian', 'elder_guardian',
  'warden', 'breeze', 'bogged',
]);

function isHostile(entity) {
  return HOSTILE_MOBS.has((entity.name || '').toLowerCase());
}

// Start MCP server and dashboard immediately
startMcpServer(state);
startDashboard(state);

// Clear the queue on startup
writeFileSync(CHAT_QUEUE, '', 'utf8');

function createBot() {
  console.log(`[Bot] Connecting to ${SERVER_HOST}:${SERVER_PORT} as ${BOT_NAME}...`);

  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    port: SERVER_PORT,
    username: BOT_NAME,
    version: MC_VERSION,
    auth: 'offline',
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => {
    console.log('[Bot] Spawned in world');
    console.log('[Bot] Gamemode:', bot.game.gameMode);
    state.bot = bot;
    state.activeTask = { kind: 'idle' };

    const movements = new Movements(bot);
    bot.pathfinder.setMovements(movements);

    bot.chat('ClaudeBot online. Ready for commands (@claude or @team).');
  });

  bot.on('chat', (username, message) => {
    // Log all chat to dashboard
    if (username === BOT_NAME) {
      logBotChat(message);
      return;
    }
    logPlayerChat(username, message);

    const lower = message.toLowerCase();
    const isForMe = lower.includes('@claude') || lower.includes('@team');
    if (!isForMe) return;

    const entry = `${username}: ${message}\n`;
    console.log(`[Chat] Queuing: ${entry.trim()}`);
    appendFileSync(CHAT_QUEUE, entry, 'utf8');
  });

  // Co-mine inference: trigger when player mines 2+ of same block type within 10s
  const playerMineTracker = {};
  bot.on('blockBreakProgressObserved', (block, destroyStage, entity) => {
    if (!entity?.username || entity.username === BOT_NAME) return;
    const username = entity.username;
    const now = Date.now();
    const posKey = `${block.position.x},${block.position.y},${block.position.z}`;

    let tracker = playerMineTracker[username];
    if (!tracker || tracker.blockName !== block.name || now - tracker.firstTime > 10000) {
      tracker = { seenBlocks: new Set([posKey]), blockName: block.name, firstTime: now };
      playerMineTracker[username] = tracker;
    } else {
      tracker.seenBlocks.add(posKey);
    }

    // Keep co-mine alive while player is actively mining
    if (state.activeTask.kind === 'comine' && state.activeTask.playerName === username) {
      state.activeTask.lastPlayerMine = now;
    }

    const canStart = state.activeTask.kind === 'idle' || state.activeTask.kind === 'follow';
    if (tracker.seenBlocks.size >= 2 && canStart) {
      state.activeTask = { kind: 'comine', blockType: block.name, playerName: username, lastPlayerMine: now };
      bot.chat(`Co-mining ${block.name} with you!`);
      playerMineTracker[username] = { seenBlocks: new Set(), blockName: block.name, firstTime: now };
    }
  });

  // Supply runner: auto-collect dropped items when storage is configured
  bot.on('entitySpawn', (entity) => {
    if (!state.storagePos) return;
    if (entity.name !== 'item') return;
    const dist = entity.position.distanceTo(bot.entity.position);
    if (dist > 8) return;

    setTimeout(() => {
      const stillThere = bot.entities[entity.id];
      if (!stillThere) return;
      bot.pathfinder.setGoal(
        new goals.GoalNear(entity.position.x, entity.position.y, entity.position.z, 1)
      );
    }, 2000);
  });

  bot.on('death', () => {
    console.log('[Bot] Died — respawning...');
    bot.respawn();
  });

  bot.on('error', (err) => {
    console.error('[Bot] Error:', err.message);
  });

  bot.on('end', (reason) => {
    console.log(`[Bot] Disconnected: ${reason}. Reconnecting in 5s...`);
    state.bot = null;
    state.activeTask = { kind: 'idle' };
    setTimeout(createBot, 5000);
  });

  // 500ms tick loop for activeTask execution
  const tickInterval = setInterval(() => {
    if (!state.bot || !state.activeTask) return;
    const task = state.activeTask;

    executeGuardianTick(bot, state);

    if (task.kind === 'follow') {
      const target = bot.players[task.playerName]?.entity;
      if (target && !bot.pathfinder.isMoving()) {
        bot.pathfinder.setGoal(new GoalFollow(target, task.range ?? 3), true);
      }
    } else if (task.kind === 'mine') {
      executeMineTask(bot, task, state);
    } else if (task.kind === 'collect') {
      executeCollectTask(bot, task, state);
    } else if (task.kind === 'attack') {
      executeAttackTask(bot, task, state);
    } else if (task.kind === 'comine') {
      executeComineTask(bot, task, state);
    }
  }, 500);

  bot.on('entityHurt', (entity) => {
    if (!state.guardEnabled) return;
    if (state.activeTask.kind === 'attack') return;
    if (entity.type !== 'player' || entity.username === BOT_NAME) return;

    const attacker = Object.values(bot.entities)
      .filter(e => isHostile(e) && e.position.distanceTo(entity.position) < 15)
      .sort((a, b) => a.position.distanceTo(entity.position) - b.position.distanceTo(entity.position))[0];

    if (attacker) {
      bot.chat(`Defending you from ${attacker.name}!`);
      state.activeTask = { kind: 'attack', targetName: attacker.name, range: 20, targetId: attacker.id };
    }
  });

  bot.on('end', () => clearInterval(tickInterval));

  return bot;
}

function executeGuardianTick(bot, state) {
  if (!state.guardEnabled) return;
  if (state.activeTask.kind === 'attack') return;

  const players = Object.values(bot.players).filter(p => p.entity && p.username !== BOT_NAME);
  if (players.length === 0) return;

  let threat = null;
  let threatDist = Infinity;
  for (const player of players) {
    for (const entity of Object.values(bot.entities)) {
      if (!isHostile(entity)) continue;
      const d = entity.position.distanceTo(player.entity.position);
      if (d < 12 && d < threatDist) { threat = entity; threatDist = d; }
    }
  }

  if (!threat) return;

  // Don't engage creeper when it's already close to the bot (explosion risk)
  const name = (threat.name || '').toLowerCase();
  if (name === 'creeper' && threat.position.distanceTo(bot.entity.position) < 4) return;

  bot.chat(`Defending from ${threat.name}!`);
  state.activeTask = { kind: 'attack', targetName: threat.name, range: 20, targetId: threat.id };
}

async function executeComineTask(bot, task, state) {
  if (task.busy) return;

  const player = bot.players[task.playerName]?.entity;
  if (!player) { state.activeTask = { kind: 'idle' }; return; }

  if (player.position.distanceTo(bot.entity.position) > 20) {
    state.activeTask = { kind: 'idle' };
    bot.chat('Too far to co-mine.');
    return;
  }

  // Stop if player hasn't mined recently
  if (task.lastPlayerMine && Date.now() - task.lastPlayerMine > 5000) {
    state.activeTask = { kind: 'idle' };
    bot.chat('Co-mine done.');
    return;
  }

  const blockType = bot.registry.blocksByName[task.blockType];
  if (!blockType) { state.activeTask = { kind: 'idle' }; return; }

  const block = bot.findBlock({ matching: blockType.id, maxDistance: 6, point: player.position });
  if (!block) return;

  // Never mine within 1.5 blocks of the player
  if (block.position.distanceTo(player.position) < 1.5) return;

  task.busy = true;
  try {
    await bot.pathfinder.goto(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 1));
    if (bot.canDigBlock(block)) await bot.dig(block);
    await new Promise(r => setTimeout(r, 500));
  } catch (err) {
    console.error('[Comine] Error:', err.message);
  } finally {
    task.busy = false;
  }
}

async function executeMineTask(bot, task, state) {
  if (task.busy) return;
  if (task.mined >= task.count) {
    state.activeTask = { kind: 'idle' };
    bot.chat(`Done mining ${task.count} ${task.blockName}`);
    return;
  }

  const blockType = bot.registry.blocksByName[task.blockName];
  if (!blockType) {
    bot.chat(`Unknown block: ${task.blockName}`);
    state.activeTask = { kind: 'idle' };
    return;
  }

  const block = bot.findBlock({ matching: blockType.id, maxDistance: task.range ?? 32 });
  if (!block) {
    bot.chat(`No ${task.blockName} found nearby`);
    state.activeTask = { kind: 'idle' };
    return;
  }

  task.busy = true;
  try {
    // Stand right next to the block so the dropped item is within pickup range
    await bot.pathfinder.goto(new goals.GoalNear(block.position.x, block.position.y, block.position.z, 1));
    await bot.dig(block);
    task.mined++;
    // Wait for the item to drop and auto-collect (Minecraft pickup range is ~1 block)
    await new Promise(r => setTimeout(r, 1500));
    console.log(`[Mine] ${task.blockName} ${task.mined}/${task.count}, inventory: ${bot.inventory.items().map(i => i.name + 'x' + i.count).join(', ') || 'empty'}`);
  } catch (err) {
    console.error('[Mine] Error:', err.message);
  } finally {
    task.busy = false;
  }
}

async function executeAttackTask(bot, task, state) {
  if (task.busy) return;

  const pos = bot.entity.position;
  // Prefer tracked entity by id; re-scan if it's gone
  let target = task.targetId ? bot.entities[task.targetId] : null;

  if (!target) {
    target = Object.values(bot.entities).find(e => {
      if (e === bot.entity) return false;
      if (e.position.distanceTo(pos) > (task.range ?? 20)) return false;
      const name = (e.username || e.displayName?.toString() || e.name || '').toLowerCase();
      return name.includes(task.targetName.toLowerCase());
    });
  }

  if (!target) {
    bot.chat(`${task.targetName} defeated!`);
    state.activeTask = { kind: 'idle' };
    return;
  }

  task.targetId = target.id;
  task.busy = true;
  try {
    const dist = target.position.distanceTo(pos);
    if (dist > 3) {
      bot.pathfinder.setGoal(new GoalFollow(target, 2), true);
    } else {
      bot.pathfinder.setGoal(null);
      bot.attack(target);
    }
  } catch (err) {
    console.error('[Attack] Error:', err.message);
  } finally {
    task.busy = false;
  }
}

async function executeCollectTask(bot, task, state) {
  if (task.busy) return;

  const pos = bot.entity.position;
  const items = Object.values(bot.entities).filter(e => {
    if (e.type !== 'object' && e.entityType !== 2) return false;
    if (e.position.distanceTo(pos) > (task.range ?? 16)) return false;
    return true;
  });

  if (items.length === 0) {
    state.activeTask = { kind: 'idle' };
    return;
  }

  const nearest = items.sort((a, b) => a.position.distanceTo(pos) - b.position.distanceTo(pos))[0];
  task.busy = true;
  try {
    await bot.pathfinder.goto(new goals.GoalNear(nearest.position.x, nearest.position.y, nearest.position.z, 1));
  } catch (err) {
    console.error('[Collect] Error:', err.message);
  } finally {
    task.busy = false;
  }
}

createBot();
