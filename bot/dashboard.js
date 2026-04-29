import express from 'express';
import { appendFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import EventEmitter from 'events';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAT_QUEUE = join(__dirname, 'chat-queue.txt');
const WAYPOINTS_FILE = join(__dirname, 'waypoints.json');
const DASHBOARD_PORT = 8889;

export const dashboardEmitter = new EventEmitter();
dashboardEmitter.setMaxListeners(50);

// Rolling chat log (last 100 messages)
const chatLog = [];
function addChat(from, message) {
  const entry = { from, message, ts: Date.now() };
  chatLog.push(entry);
  if (chatLog.length > 100) chatLog.shift();
  dashboardEmitter.emit('event', { type: 'chat', ...entry });
}

export function logBotChat(message) { addChat('ClaudeBot', message); }
export function logPlayerChat(username, message) { addChat(username, message); }

export function startDashboard(state) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(__dirname, 'public')));

  // SSE — real-time event stream
  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Flush current state immediately
    res.write(`data: ${JSON.stringify({ type: 'status', ...getStatus(state) })}\n\n`);
    // Flush recent chat
    chatLog.forEach(e => res.write(`data: ${JSON.stringify({ type: 'chat', ...e })}\n\n`));

    const onEvent = (e) => res.write(`data: ${JSON.stringify(e)}\n\n`);
    dashboardEmitter.on('event', onEvent);
    req.on('close', () => dashboardEmitter.off('event', onEvent));
  });

  // Periodic status push (every 2s)
  setInterval(() => {
    dashboardEmitter.emit('event', { type: 'status', ...getStatus(state) });
  }, 2000);

  // REST status
  app.get('/api/status', (_req, res) => res.json(getStatus(state)));

  // Waypoints — read-only from dashboard
  app.get('/api/waypoints', (_req, res) => {
    try {
      const wps = existsSync(WAYPOINTS_FILE)
        ? JSON.parse(readFileSync(WAYPOINTS_FILE, 'utf8'))
        : {};
      res.json(wps);
    } catch {
      res.json({});
    }
  });

  // Send command — writes to chat queue just like in-game chat
  app.post('/api/command', (req, res) => {
    const { message } = req.body ?? {};
    if (!message?.trim()) return res.status(400).json({ error: 'message required' });
    const line = `Dashboard: ${message.trim()}\n`;
    appendFileSync(CHAT_QUEUE, line, 'utf8');
    addChat('You', message.trim());
    res.json({ ok: true });
  });

  app.listen(DASHBOARD_PORT, '127.0.0.1', () => {
    console.log(`[Dashboard] http://127.0.0.1:${DASHBOARD_PORT}`);
  });
}

function getStatus(state) {
  const bot = state.bot;
  if (!bot) return { connected: false };
  const pos = bot.entity?.position;
  return {
    connected: true,
    pos: pos ? { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) } : null,
    health: bot.health ?? 0,
    food: bot.food ?? 0,
    task: state.activeTask?.kind ?? 'idle',
    players: Object.values(bot.players ?? {})
      .filter(p => p.username !== bot.username)
      .map(p => p.username),
  };
}
