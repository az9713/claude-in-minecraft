/**
 * Smoke test: connects a TestBot to the MC server, sends "@claude get status",
 * and waits for ClaudeBot to reply within 15 seconds.
 *
 * Usage: node test/smoke-test.js
 * Requires: MC server running, bot (node bot/index.js) running, agent (run.ps1) running
 */
import { createRequire } from 'module';
const require = createRequire(new URL('../bot/node_modules/', import.meta.url));
const mineflayer = require('mineflayer');

const TIMEOUT_MS = 45000;
const BOT_NAME = 'TestBot';
const TARGET_BOT = 'ClaudeBot';

console.log('[Test] Connecting TestBot to server...');

const bot = mineflayer.createBot({
  host: '127.0.0.1',
  port: 25565,
  username: BOT_NAME,
  version: '1.21.11',
  auth: 'offline',
});

let passed = false;

const timer = setTimeout(() => {
  if (!passed) {
    console.error(`[Test] FAIL — no reply from ${TARGET_BOT} within ${TIMEOUT_MS}ms`);
    bot.quit();
    process.exit(1);
  }
}, TIMEOUT_MS);

bot.once('spawn', () => {
  console.log('[Test] TestBot spawned. Waiting 3s then sending command...');
  setTimeout(() => {
    console.log('[Test] Sending: @claude get status');
    bot.chat('@claude get status');
  }, 3000);
});

bot.on('chat', (username, message) => {
  if (username === TARGET_BOT) {
    passed = true;
    clearTimeout(timer);
    console.log(`[Test] PASS — ${TARGET_BOT} replied: "${message}"`);
    bot.quit();
    process.exit(0);
  }
});

bot.on('error', (err) => {
  console.error('[Test] Bot error:', err.message);
  clearTimeout(timer);
  process.exit(1);
});
