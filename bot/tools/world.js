import { z } from 'zod';
import pkg from 'mineflayer-pathfinder';

const { goals } = pkg;
const { GoalNear } = goals;

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

  server.tool(
    'craft_item',
    'Craft an item using inventory materials. Navigates to a nearby crafting table if a 3x3 recipe is needed.',
    {
      itemName: z.string().describe('Item to craft, e.g. "crafting_table", "wooden_pickaxe", "torch", "stick"'),
      count: z.number().int().min(1).default(1).describe('Number of items to craft'),
    },
    async ({ itemName, count }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');

      const item = bot.registry.itemsByName[itemName];
      if (!item) return text(`Unknown item: ${itemName}`);

      // Try 2x2 inventory crafting first
      let recipes = bot.recipesFor(item.id, null, 1, null);
      let craftingTable = null;

      if (recipes.length === 0) {
        // Need a crafting table
        const tableType = bot.registry.blocksByName['crafting_table'];
        const tableBlock = tableType
          ? bot.findBlock({ matching: tableType.id, maxDistance: 32 })
          : null;

        if (!tableBlock) {
          return text(`No 2x2 recipe found for ${itemName} and no crafting table nearby`);
        }

        try {
          await bot.pathfinder.goto(new GoalNear(tableBlock.position.x, tableBlock.position.y, tableBlock.position.z, 2));
        } catch (err) {
          return text(`Cannot reach crafting table: ${err.message}`);
        }

        craftingTable = tableBlock;
        recipes = bot.recipesFor(item.id, null, 1, craftingTable);
      }

      if (recipes.length === 0) {
        return text(`No recipe available for ${itemName} (missing ingredients?)`);
      }

      try {
        await bot.craft(recipes[0], count, craftingTable);
        return text(`Crafted ${count}x ${itemName}`);
      } catch (err) {
        return text(`Craft failed: ${err.message}`);
      }
    }
  );

  server.tool(
    'place_block',
    'Place a block from inventory at the specified coordinates (requires an adjacent solid block to place against)',
    {
      blockName: z.string().describe('Block to place, e.g. "dirt", "cobblestone", "oak_log"'),
      x: z.number().describe('X coordinate'),
      y: z.number().describe('Y coordinate'),
      z: z.number().describe('Z coordinate'),
    },
    async ({ blockName, x, y, z: zCoord }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');

      const item = bot.inventory.findInventoryItem(blockName, null, false);
      if (!item) return text(`${blockName} not in inventory`);

      // Navigate within placement range
      try {
        await bot.pathfinder.goto(new GoalNear(x, y, zCoord, 3));
      } catch (err) {
        return text(`Cannot reach position: ${err.message}`);
      }

      await bot.equip(item, 'hand');

      // Try each adjacent face to find a solid reference block
      const faces = [
        { dx: 0, dy: -1, dz: 0,  face: { x: 0, y: 1,  z: 0  } },
        { dx: 0, dy: 1,  dz: 0,  face: { x: 0, y: -1, z: 0  } },
        { dx: 1, dy: 0,  dz: 0,  face: { x: -1, y: 0, z: 0  } },
        { dx: -1, dy: 0, dz: 0,  face: { x: 1,  y: 0, z: 0  } },
        { dx: 0, dy: 0,  dz: 1,  face: { x: 0,  y: 0, z: -1 } },
        { dx: 0, dy: 0,  dz: -1, face: { x: 0,  y: 0, z: 1  } },
      ];

      for (const { dx, dy, dz, face } of faces) {
        const ref = bot.blockAt({ x: x + dx, y: y + dy, z: zCoord + dz });
        if (!ref || ref.name === 'air') continue;
        try {
          await bot.placeBlock(ref, face);
          return text(`Placed ${blockName} at ${x} ${y} ${zCoord}`);
        } catch {
          // try next face
        }
      }

      return text(`Cannot place ${blockName}: no adjacent solid block at ${x} ${y} ${zCoord}`);
    }
  );
}

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
