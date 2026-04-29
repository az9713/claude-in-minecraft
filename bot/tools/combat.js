import { z } from 'zod';

export function registerCombatTools(server, state) {
  server.tool(
    'attack_entity',
    'Attack a nearby entity (mob, animal, or player) by name/type until defeated or gone. Runs as background task.',
    {
      targetName: z.string().describe('Entity name or type to attack, e.g. "zombie", "skeleton", "creeper", "cow"'),
      range: z.number().default(20).describe('Search radius in blocks'),
    },
    async ({ targetName, range }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');

      const pos = bot.entity.position;
      const target = Object.values(bot.entities).find(e => {
        if (e === bot.entity) return false;
        if (e.position.distanceTo(pos) > range) return false;
        const name = (e.username || e.displayName?.toString() || e.name || '').toLowerCase();
        return name.includes(targetName.toLowerCase());
      });

      if (!target) return text(`No ${targetName} found within ${range} blocks`);

      state.activeTask = { kind: 'attack', targetName, range, targetId: target.id };
      return text(`Attacking ${targetName} (id ${target.id})`);
    }
  );
}

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
