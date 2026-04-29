import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pkg from 'mineflayer-pathfinder';

const { goals } = pkg;
const { GoalNear } = goals;

const __dirname = dirname(fileURLToPath(import.meta.url));
const WAYPOINTS_FILE = join(__dirname, '..', 'waypoints.json');

function load() {
  if (!existsSync(WAYPOINTS_FILE)) return {};
  try { return JSON.parse(readFileSync(WAYPOINTS_FILE, 'utf8')); }
  catch { return {}; }
}

function save(wps) {
  writeFileSync(WAYPOINTS_FILE, JSON.stringify(wps, null, 2), 'utf8');
}

export function registerWaypointTools(server, state) {
  server.tool(
    'save_waypoint',
    "Save the bot's current position as a named waypoint for later navigation",
    { name: z.string().describe('Waypoint name, e.g. "base", "mine", "farm"') },
    async ({ name }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      const pos = bot.entity.position;
      const x = Math.round(pos.x);
      const y = Math.round(pos.y);
      const z = Math.round(pos.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) {
        return text('Cannot save waypoint — position not loaded yet. Move a few blocks and try again.');
      }
      const wps = load();
      const key = name.toLowerCase();
      wps[key] = { x, y, z };
      save(wps);
      return text(`Saved "${key}" at ${x} ${y} ${z}`);
    }
  );

  server.tool(
    'goto_waypoint',
    'Navigate to a previously saved named waypoint',
    { name: z.string().describe('Waypoint name to travel to') },
    async ({ name }) => {
      const bot = state.bot;
      if (!bot) return text('Bot not connected');
      const wps = load();
      const wp = wps[name.toLowerCase()];
      if (!wp) {
        const known = Object.keys(wps).join(', ') || 'none';
        return text(`Unknown waypoint "${name}". Known: ${known}`);
      }
      state.activeTask = { kind: 'navigate', x: wp.x, y: wp.y, z: wp.z };
      bot.pathfinder.setGoal(new GoalNear(wp.x, wp.y, wp.z, 2));
      return text(`Navigating to "${name}" at ${wp.x} ${wp.y} ${wp.z}`);
    }
  );

  server.tool(
    'list_waypoints',
    'List all saved waypoints and their coordinates',
    {},
    async () => {
      const wps = load();
      const entries = Object.entries(wps);
      if (entries.length === 0) return text('No waypoints saved yet');
      const lines = entries.map(([n, p]) => `${n}: ${p.x} ${p.y} ${p.z}`).join('\n');
      return text(lines);
    }
  );

  server.tool(
    'delete_waypoint',
    'Delete a named waypoint',
    { name: z.string().describe('Waypoint name to remove') },
    async ({ name }) => {
      const wps = load();
      const key = name.toLowerCase();
      if (!wps[key]) return text(`Waypoint "${name}" not found`);
      delete wps[key];
      save(wps);
      return text(`Deleted waypoint "${name}"`);
    }
  );
}

function text(t) {
  return { content: [{ type: 'text', text: t }] };
}
