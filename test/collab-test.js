/**
 * Collaboration features test — calls MCP tools directly (no agent runner / LLM latency).
 * Tests: guard_player, co_mine, set_storage, mule_status, deposit_items.
 *
 * Usage: node test/collab-test.js
 * Requires: MC server running + bot (node bot/index.js) running.
 * Agent runner is NOT needed for this test.
 */

const MCP_URL = 'http://127.0.0.1:8888/mcp';

// ── MCP session helpers ───────────────────────────────────────────────────────
let sessionId = null;
let msgId = 1;

async function mcpPost(body) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!sessionId) sessionId = res.headers.get('mcp-session-id');

  const text = await res.text();
  if (!text || !text.trim()) return null; // empty response (e.g. notifications)

  // Parse SSE stream or plain JSON
  const lines = text.split('\n').filter(l => l.startsWith('data:'));
  if (lines.length > 0) {
    const lastData = lines[lines.length - 1].slice(5).trim();
    return lastData ? JSON.parse(lastData) : null;
  }
  return JSON.parse(text);
}

async function initSession() {
  const resp = await mcpPost({
    jsonrpc: '2.0', id: msgId++, method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'collab-test', version: '1' } },
  });
  if (resp?.error) throw new Error(`Init failed: ${resp.error.message}`);
  return resp;
}

async function callTool(name, args = {}) {
  const resp = await mcpPost({
    jsonrpc: '2.0', id: msgId++, method: 'tools/call',
    params: { name, arguments: args },
  });
  if (resp.error) throw new Error(`Tool ${name} error: ${resp.error.message}`);
  return resp.result?.content?.[0]?.text ?? '';
}

// ── Test runner ───────────────────────────────────────────────────────────────
const results = [];
function pass(name, info = '') { results.push({ name, ok: true }); console.log(`[Test] PASS: ${name}${info ? ' — ' + info : ''}`); }
function fail(name, reason)    { results.push({ name, ok: false, reason }); console.log(`[Test] FAIL: ${name} — ${reason}`); }

async function runTests() {
  console.log('[Test] Initializing MCP session...');
  await initSession();
  console.log(`[Test] Session: ${sessionId?.slice(0, 8)}`);

  // ── 1. Guardian disable ───────────────────────────────────────────────────
  try {
    const r = await callTool('guard_player', { enable: false });
    r.includes('OFF') ? pass('guard_player disable', r) : fail('guard_player disable', `unexpected: ${r}`);
  } catch (e) { fail('guard_player disable', e.message); }

  // ── 2. Guardian enable ────────────────────────────────────────────────────
  try {
    const r = await callTool('guard_player', { enable: true });
    r.includes('ON') ? pass('guard_player enable', r) : fail('guard_player enable', `unexpected: ${r}`);
  } catch (e) { fail('guard_player enable', e.message); }

  // ── 3. co_mine (explicit) — no nearby player so expect graceful error ─────
  try {
    const r = await callTool('co_mine', { blockName: 'stone', playerName: 'TestBot' });
    // TestBot is not in the world right now, so expect "not found" or "Co-mining"
    if (r.includes('Co-mining') || r.includes('not found')) {
      pass('co_mine explicit', r);
    } else {
      fail('co_mine explicit', `unexpected: ${r}`);
    }
  } catch (e) { fail('co_mine explicit', e.message); }

  // ── 4. set_storage ────────────────────────────────────────────────────────
  try {
    const r = await callTool('set_storage');
    r.includes('Storage set') ? pass('set_storage', r) : fail('set_storage', `unexpected: ${r}`);
  } catch (e) { fail('set_storage', e.message); }

  // ── 5. mule_status ────────────────────────────────────────────────────────
  try {
    const r = await callTool('mule_status');
    r.includes('Auto-collect') ? pass('mule_status', r) : fail('mule_status', `unexpected: ${r}`);
  } catch (e) { fail('mule_status', e.message); }

  // ── 6. deposit_items (no chest present — expect graceful error) ───────────
  try {
    const r = await callTool('deposit_items');
    if (r.includes('Deposited') || r.includes('Nothing') || r.includes('No chest') || r.includes('Cannot reach') || r.includes('Deposit failed')) {
      pass('deposit_items (graceful)', r);
    } else {
      fail('deposit_items (graceful)', `unexpected: ${r}`);
    }
  } catch (e) { fail('deposit_items (graceful)', e.message); }

  // ── 7. get_status (sanity check bot is responsive) ───────────────────────
  try {
    const r = await callTool('get_status');
    (r.includes('health') || r.includes('HP')) ? pass('get_status sanity', r.slice(0, 60)) : fail('get_status sanity', `unexpected: ${r.slice(0, 60)}`);
  } catch (e) { fail('get_status sanity', e.message); }

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter(r => r.ok).length;
  console.log(`\n[Test] ${passed}/${results.length} passed`);
  results.filter(r => !r.ok).forEach(r => console.log(`  FAIL: ${r.name} — ${r.reason}`));
  process.exit(passed === results.length ? 0 : 1);
}

runTests().catch(err => {
  console.error('[Test] Fatal:', err.message);
  process.exit(1);
});
