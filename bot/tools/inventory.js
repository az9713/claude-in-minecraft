import { z } from 'zod';
import pkg from 'mineflayer-pathfinder';

const { goals } = pkg;
const { GoalNear } = goals;

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
}

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
