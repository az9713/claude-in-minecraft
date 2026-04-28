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
};

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

    if (task.kind === 'follow') {
      const target = bot.players[task.playerName]?.entity;
      if (target && !bot.pathfinder.isMoving()) {
        bot.pathfinder.setGoal(new GoalFollow(target, task.range ?? 3), true);
      }
    } else if (task.kind === 'mine') {
      executeMineTask(bot, task, state);
    } else if (task.kind === 'collect') {
      executeCollectTask(bot, task, state);
    }
  }, 500);

  bot.on('end', () => clearInterval(tickInterval));

  return bot;
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
