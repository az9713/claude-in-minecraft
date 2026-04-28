# ADR 002: Per-message claude -p invocations over a persistent Claude session

**Status:** Accepted

## Context

Claude can be invoked in two modes:

1. **Per-message (`claude -p`)** — starts, processes one prompt, exits
2. **Persistent session (`claude` with stdin streaming)** — starts once, receives a stream of messages via `--input-format stream-json`, stays alive

A persistent session would reduce per-command overhead (~3s startup) and maintain Claude's conversation history across commands. The agent runner would pipe new messages to Claude's stdin instead of spawning a new process.

## Decision

Use per-message `claude -p` invocations. Each command from the game spawns a fresh Claude process.

## Alternatives considered

### Persistent Claude session with stream-json input

**Pros:**
- 3s faster per command (no startup)
- Claude maintains conversation history ("last command was X, now do Y")
- More natural multi-turn interaction

**Cons:**
- Complex stdin management in bash — requires a named pipe or background process
- If Claude crashes, the session must be restarted and re-initialised
- Session context accumulates unboundedly — costs more tokens over time
- Much harder to debug (can't replay a single invocation)

### Per-message invocations (chosen)

**Pros:**
- Dead simple: one bash line spawns Claude, it exits when done
- Each command is independently reproducible — paste the command into a terminal to debug
- Context stays small — each invocation starts fresh
- Claude's MCP tool list is fetched fresh each time — no stale tool state

**Cons:**
- ~3s overhead per command (Claude startup + MCP initialisation)
- Claude has no memory of previous commands within a session (must call `get_status` each time)
- Context about what ClaudeBot just did is lost (mitigated by `state.activeTask` in the bot process)

## Rationale

The system's primary constraint is simplicity and debuggability. The polling loop in bash is 30 lines. A persistent stdin-streaming setup requires careful process management, error handling, and session recovery. The 3s overhead is acceptable for a game-companion use case where commands are infrequent and latency of 15–20s total is already expected.

The loss of conversation history is mitigated by the `get_status` call at the start of each Claude invocation: Claude always knows where it is and what task is running.

## Trade-offs

The 3s startup cost accumulates: 10 commands = 30s of overhead. For rapid-fire command sequences this is noticeable. Future work: use `claude -c` (continue session) to reduce startup cost while keeping the per-message invocation model.

## Consequences

- `state.activeTask` in the bot process must carry the full context of what ClaudeBot is doing, because Claude has no memory of the previous command.
- The `get_status` MCP tool is critical — Claude calls it first to orient itself on every invocation.
- Each `claude -p` process gets a fresh MCP session with the bot process.
