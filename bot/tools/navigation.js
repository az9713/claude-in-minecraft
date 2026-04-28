import { z } from 'zod';
import pkg from 'mineflayer-pathfinder';

const { goals } = pkg;
const { GoalNear, GoalFollow } = goals;

export function registerNavigationTools(server, state) {
  server.tool(
    'navigate_to',
    'Navigate bot to coordinates using pathfinding. Returns immediately; movement continues in background.',
    {
      x: z.number().describe('Target X coordinate'),
      y: z.number().describe('Target Y coordinate (use 64 if unsure)'),
      z: z.number().describe('Target Z coordinate'),
      range: z.number().default(2).describe('Stop within this many blocks of target'),
    },
    async ({ x, y, z: zCoord, range }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      state.activeTask = { kind: 'navigate', x, y, z: zCoord };
      bot.pathfinder.setGoal(new GoalNear(x, y, zCoord, range));
      return text(`Navigating to ${x} ${y} ${zCoord}`);
    }
  );

  server.tool(
    'follow_player',
    'Follow a player continuously until stop_action is called',
    {
      playerName: z.string().describe('Exact in-game username to follow'),
      range: z.number().default(3).describe('Follow distance in blocks'),
    },
    async ({ playerName, range }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      const player = bot.players[playerName];
      if (!player?.entity) return text(`Player ${playerName} not found or not in range`);
      state.activeTask = { kind: 'follow', playerName, range };
      bot.pathfinder.setGoal(new GoalFollow(player.entity, range), true);
      return text(`Following ${playerName}`);
    }
  );

  server.tool(
    'stop_action',
    'Stop all current movement and tasks, return to idle',
    {},
    async () => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      state.activeTask = { kind: 'idle' };
      bot.pathfinder.setGoal(null);
      return text('Stopped, now idle');
    }
  );

  server.tool(
    'rejoin_server',
    'Disconnect and reconnect the bot to reset game state',
    {},
    async () => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      state.activeTask = { kind: 'idle' };
      bot.quit();
      // reconnect is handled by the 'end' event listener in index.js
      return text('Rejoining server...');
    }
  );
}

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
