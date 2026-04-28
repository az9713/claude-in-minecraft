# Agent runner

## What it is

`agent/run.sh` is a bash polling loop that watches `bot/chat-queue.txt` and invokes `claude -p` whenever a message arrives. It is the bridge between the game world (where messages originate) and Claude (which processes them).

## What problem it solves

`claude -p` is a one-shot process: it takes a prompt, runs, and exits. But ClaudeBot must be available to respond to many commands over a session. The agent runner provides the "always on" wrapper: it continuously monitors for new messages and spawns a Claude process for each one.

## How it works

### Polling loop

```
every 500ms:
  if lockfile exists:
    if lockfile age > 60s → delete it (crash guard)
    else → skip this tick
  if chat-queue.txt is empty → skip
  create lockfile
  read and clear chat-queue.txt
  invoke claude -p with the message
  delete lockfile
```

### Claude invocation

```bash
claude -p \
  --strict-mcp-config \
  --mcp-config "$MCP_CONFIG" \
  --append-system-prompt-file "$PROMPT_FILE" \
  --permission-mode bypassPermissions \
  --max-turns 8 \
  "$msg"
```

| Flag | Purpose |
|---|---|
| `--strict-mcp-config` | Only use MCP servers from the specified config; ignore user's global MCP config |
| `--mcp-config` | Points to `agent/mcp-config.json` which defines the minecraft MCP server |
| `--append-system-prompt-file` | Appends `agent/prompt.md` (ClaudeBot persona) to Claude's default system prompt |
| `--permission-mode bypassPermissions` | Auto-approves all MCP tool calls without prompting; required for non-interactive use |
| `--max-turns 8` | Hard cap on agentic turns; prevents infinite loops |

### Concurrency model

Only one `claude -p` invocation runs at a time. While Claude is running:
- New messages arriving in `chat-queue.txt` are **not lost** — they accumulate
- The next invocation reads all accumulated messages as one batched prompt
- This means rapid-fire commands are batched naturally

The lockfile approach is chosen over background subprocesses because Claude tool calls are sequential (each tool call waits for the result before the next), and concurrent Claude invocations would race on `state.activeTask`.

### Stale lockfile guard

If `claude -p` crashes mid-invocation without cleaning up, the lockfile remains. The runner checks lockfile age every tick and removes it after 60 seconds. This prevents the system from permanently freezing due to a crashed Claude process.

### Logging

Every invocation is logged to `agent/agent.log`:
```
2026-04-27 15:23:21 | INPUT: YourUsername: @claude follow me
2026-04-27 15:23:41 | OUTPUT: I'm now following you!
```

`agent-runner.log` captures the runner process's own stdout/stderr (separate from the per-invocation log).

## Key files

| File | Purpose |
|---|---|
| `agent/run.sh` | The runner (bash) |
| `agent/run.ps1` | PowerShell equivalent (for non-Git Bash Windows environments) |
| `agent/mcp-config.json` | Tells Claude where the MCP server is |
| `agent/prompt.md` | ClaudeBot system prompt appended to every invocation |
| `agent/agent.log` | Per-invocation input/output log |
| `bot/chat-queue.txt` | The queue file the runner polls |
| `agent/claude-busy.lock` | Lockfile; exists only while Claude is running |

## Interaction with other subsystems

- **Bot process** writes to `chat-queue.txt`; runner reads and clears it
- **Claude** is invoked by the runner; connects to the MCP server at `http://127.0.0.1:8888/mcp`
- **Dashboard** independently serves the browser; runner does not interact with it

## Common gotchas

**Runner never fires:** Check that `chat-queue.txt` is being written. The bot chat listener only appends messages containing `@claude` or `@team`. Normal chat is ignored.

**Runner fires but Claude hangs:** The `--permission-mode bypassPermissions` flag is missing or the MCP server is not running. Verify: `curl -s http://127.0.0.1:8888/mcp` should return a non-empty response.

**Double invocation:** Two bot processes running simultaneously (leftover from a previous session) both write to `chat-queue.txt`, resulting in messages processed twice. Fix: `taskkill //F //IM node.exe` then restart.
