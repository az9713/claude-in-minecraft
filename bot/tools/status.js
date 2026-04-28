import { z } from 'zod';

export function registerStatusTools(server, state) {
  server.tool(
    'get_status',
    'Get bot position, health, hunger, current task, and nearby player list',
    {},
    async () => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');

      const pos = bot.entity.position;
      const nearbyPlayers = Object.values(bot.players)
        .filter(p => p.entity && p.username !== bot.username)
        .map(p => ({
          name: p.username,
          distance: Math.round(p.entity.position.distanceTo(pos)),
        }));

      return text(JSON.stringify({
        pos: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
        health: bot.health,
        food: bot.food,
        activeTask: state.activeTask?.kind ?? 'idle',
        nearbyPlayers,
      }));
    }
  );
}

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
