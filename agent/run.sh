#!/bin/bash
# ClaudeBot agent runner — polls chat queue and invokes claude -p headless

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUEUE_FILE="$SCRIPT_DIR/../bot/chat-queue.txt"
LOCK_FILE="$SCRIPT_DIR/claude-busy.lock"
MCP_CONFIG="$SCRIPT_DIR/mcp-config.json"
PROMPT_FILE="$SCRIPT_DIR/prompt.md"
LOG_FILE="$SCRIPT_DIR/agent.log"

echo "[Agent] ClaudeBot runner started. Watching $QUEUE_FILE"
echo "[Agent] Press Ctrl+C to stop."

# Ensure queue file exists
touch "$QUEUE_FILE"

while true; do
    sleep 0.5

    # Stale lockfile guard: if lock is older than 60s, remove it
    if [ -f "$LOCK_FILE" ]; then
        lock_age=$(( $(date +%s) - $(date -r "$LOCK_FILE" +%s 2>/dev/null || echo 0) ))
        if [ "$lock_age" -gt 60 ]; then
            echo "[Agent] Stale lock removed (age: ${lock_age}s)"
            rm -f "$LOCK_FILE"
        else
            continue
        fi
    fi

    # Skip if queue is empty or whitespace-only
    [ -f "$QUEUE_FILE" ] || continue
    msg=$(cat "$QUEUE_FILE")
    [ -n "$(echo "$msg" | tr -d '[:space:]')" ] || continue

    # Claim the queue
    touch "$LOCK_FILE"
    > "$QUEUE_FILE"

    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[Agent] $timestamp | INPUT: $msg"
    echo "$timestamp | INPUT: $msg" >> "$LOG_FILE"

    # Invoke Claude headless
    result=$(claude -p \
        --strict-mcp-config \
        --mcp-config "$MCP_CONFIG" \
        --append-system-prompt-file "$PROMPT_FILE" \
        --permission-mode bypassPermissions \
        --max-turns 8 \
        "$msg" 2>&1)

    echo "$timestamp | OUTPUT: $result" >> "$LOG_FILE"
    echo "[Agent] Done."

    rm -f "$LOCK_FILE"
done
