import { z } from 'zod';
import pkg from 'mineflayer-pathfinder';

const { goals } = pkg;
const { GoalNear } = goals;

// Common foods sorted best → worst by effective quality (foodPoints + saturation bonus)
const FOOD_PRIORITY = [
  'enchanted_golden_apple', 'golden_carrot', 'golden_apple',
  'cooked_porkchop', 'cooked_beef', 'cooked_mutton', 'cooked_salmon',
  'cooked_chicken', 'cooked_rabbit', 'cooked_cod', 'rabbit_stew',
  'mushroom_stew', 'suspicious_stew', 'pumpkin_pie', 'bread',
  'baked_potato', 'melon_slice', 'apple', 'carrot', 'dried_kelp',
  'sweet_berries', 'glow_berries', 'beef', 'porkchop', 'mutton',
  'chicken', 'salmon', 'cod', 'rabbit', 'rotten_flesh', 'spider_eye',
];

export function registerInventoryTools(server, state) {
  server.tool(
    'get_inventory',
    'List all items currently in the bot inventory',
    {},
    async () => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');

      const items = bot.inventory.items().map(item => ({
        name: item.name,
        count: item.count,
        slot: item.slot,
      }));

      return text(JSON.stringify(items));
    }
  );

  server.tool(
    'collect_nearby_items',
    'Navigate to and collect dropped item entities nearby',
    {
      itemName: z.string().optional().describe('Filter by item name (partial match), or omit for all items'),
      range: z.number().default(16).describe('Search radius in blocks'),
    },
    async ({ itemName, range }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');

      const pos = bot.entity.position;
      const droppedItems = Object.values(bot.entities).filter(e => {
        if (e.type !== 'object' && e.entityType !== 2) return false; // item entities
        if (e.position.distanceTo(pos) > range) return false;
        if (itemName && e.metadata) {
          const name = e.getDroppedItem?.()?.name ?? '';
          if (!name.includes(itemName)) return false;
        }
        return true;
      });

      if (droppedItems.length === 0) {
        return text('No dropped items found nearby');
      }

      state.activeTask = { kind: 'collect', itemName, range, targets: droppedItems.map(e => e.id) };

      // Navigate to the nearest one to start
      const nearest = droppedItems[0];
      bot.pathfinder.setGoal(
        new GoalNear(nearest.position.x, nearest.position.y, nearest.position.z, 1)
      );

      return text(`Collecting ${droppedItems.length} item(s) nearby`);
    }
  );

  server.tool(
    'eat_food',
    'Eat a food item from inventory to restore hunger. Auto-selects best food if none specified.',
    {
      foodName: z.string().optional().describe('Specific food item name, or omit to auto-pick best'),
    },
    async ({ foodName }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      if (bot.food >= 20) return text('Already full (20/20 food)');

      let item;
      if (foodName) {
        item = bot.inventory.findInventoryItem(foodName, null, false);
        if (!item) return text(`${foodName} not in inventory`);
      } else {
        for (const fname of FOOD_PRIORITY) {
          item = bot.inventory.findInventoryItem(fname, null, false);
          if (item) break;
        }
        if (!item) return text('No food items in inventory');
      }

      try {
        await bot.equip(item, 'hand');
        await bot.consume();
        return text(`Ate ${item.name}, food now ${Math.round(bot.food)}/20`);
      } catch (err) {
        return text(`Eat failed: ${err.message}`);
      }
    }
  );

  server.tool(
    'set_storage',
    'Save current position as the designated storage chest waypoint for supply-runner deposits',
    {},
    async () => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      const pos = bot.entity.position;
      const x = Math.round(pos.x), y = Math.round(pos.y), z = Math.round(pos.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return text('Position not loaded yet');
      state.storagePos = { x, y, z };
      return text(`Storage set at ${x} ${y} ${z}. Auto-collect is now active within 8 blocks.`);
    }
  );

  server.tool(
    'deposit_items',
    'Walk to the storage waypoint and deposit all carried items into the adjacent chest',
    {},
    async () => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      if (!state.storagePos) return text('No storage set — run set_storage while standing next to your chest first');

      const { x, y, z } = state.storagePos;
      const botPos = bot.entity.position;
      const distSq = (botPos.x - x) ** 2 + (botPos.y - y) ** 2 + (botPos.z - z) ** 2;
      if (distSq > 9) {
        try {
          await bot.pathfinder.goto(new GoalNear(x, y, z, 2));
        } catch (err) {
          return text(`Cannot reach storage: ${err.message}`);
        }
      }

      // Find a chest near storage — bot is already close, search 3 blocks from current position
      const chestBlock = bot.findBlock({
        matching: (block) => block.name.includes('chest'),
        maxDistance: 3,
      });
      if (!chestBlock) return text('No chest found within 3 blocks. Place a chest next to where you ran set_storage.');

      try {
        const chest = await bot.openChest(chestBlock);
        const items = bot.inventory.items();
        if (items.length === 0) { chest.close(); return text('Nothing to deposit'); }
        for (const item of items) {
          await chest.deposit(item.type, null, item.count);
        }
        chest.close();
        return text(`Deposited ${items.length} item stack(s) into chest`);
      } catch (err) {
        console.error('[Deposit] Error:', err.stack || err.message);
        return text(`Deposit failed: ${err.message}`);
      }
    }
  );

  server.tool(
    'mule_status',
    'Report what the bot is carrying and the current storage waypoint',
    {},
    async () => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      const items = bot.inventory.items();
      const carrying = items.length === 0 ? 'nothing' : items.map(i => `${i.name}x${i.count}`).join(', ');
      const storage = state.storagePos
        ? `${state.storagePos.x} ${state.storagePos.y} ${state.storagePos.z}`
        : 'not configured';
      const autoCollect = state.storagePos ? 'ON' : 'OFF';
      return text(`Auto-collect: ${autoCollect}\nStorage: ${storage}\nCarrying: ${carrying}`);
    }
  );

  server.tool(
    'drop_item',
    'Drop items from inventory onto the ground',
    {
      itemName: z.string().describe('Item name to drop, e.g. "dirt", "cobblestone"'),
      count: z.number().int().min(1).optional().describe('How many to drop (omit for entire stack)'),
    },
    async ({ itemName, count }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');

      const item = bot.inventory.findInventoryItem(itemName, null, false);
      if (!item) return text(`${itemName} not in inventory`);

      const dropCount = count ?? item.count;
      try {
        await bot.toss(item.type, null, dropCount);
        return text(`Dropped ${dropCount}x ${itemName}`);
      } catch (err) {
        return text(`Drop failed: ${err.message}`);
      }
    }
  );
}

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
