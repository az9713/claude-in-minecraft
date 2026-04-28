import { z } from 'zod';

export function registerWorldTools(server, state) {
  server.tool(
    'mine_block',
    'Find the nearest block of a given type and mine it (count times). Returns immediately; mining continues in background.',
    {
      blockName: z.string().describe('Block type e.g. "oak_log", "stone", "coal_ore"'),
      count: z.number().int().min(1).default(1).describe('Number of blocks to mine'),
      range: z.number().default(32).describe('Search radius in blocks'),
    },
    async ({ blockName, count, range }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      state.activeTask = { kind: 'mine', blockName, count, range, mined: 0 };
      return text(`Mining ${count} ${blockName}`);
    }
  );

  server.tool(
    'get_nearby_blocks',
    'List block types within range of the bot (useful for scouting resources)',
    {
      range: z.number().default(16).describe('Search radius in blocks'),
      filter: z.string().optional().describe('Partial block name to filter, e.g. "log", "ore"'),
    },
    async ({ range, filter }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');

      const pos = bot.entity.position;
      const blocks = bot.findBlocks({
        matching: (block) => {
          if (!block || block.name === 'air') return false;
          if (filter && !block.name.includes(filter)) return false;
          return true;
        },
        maxDistance: range,
        count: 200,
      });

      // Aggregate by block name
      const counts = {};
      const nearest = {};
      for (const bPos of blocks) {
        const block = bot.blockAt(bPos);
        if (!block) continue;
        const name = block.name;
        counts[name] = (counts[name] || 0) + 1;
        if (!nearest[name]) nearest[name] = bPos;
      }

      const result = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([name, count]) => ({
          type: name,
          count,
          nearestPos: {
            x: Math.round(nearest[name].x),
            y: Math.round(nearest[name].y),
            z: Math.round(nearest[name].z),
          },
        }));

      return text(JSON.stringify(result));
    }
  );

  server.tool(
    'get_nearby_entities',
    'List entities (players, mobs, animals) within range',
    {
      range: z.number().default(32).describe('Search radius in blocks'),
    },
    async ({ range }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');

      const pos = bot.entity.position;
      const entities = Object.values(bot.entities)
        .filter(e => e !== bot.entity && e.position.distanceTo(pos) <= range)
        .map(e => ({
          name: e.username || e.displayName?.toString() || e.name || e.type,
          type: e.type,
          distance: Math.round(e.position.distanceTo(pos)),
          pos: {
            x: Math.round(e.position.x),
            y: Math.round(e.position.y),
            z: Math.round(e.position.z),
          },
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 20);

      return text(JSON.stringify(entities));
    }
  );
}

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
