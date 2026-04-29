# Key concepts

Definitions for every term used across the docs.

---

**activeTask** — A shared state object (`{ kind, ...params }`) held by `bot/index.js` that describes what ClaudeBot is currently doing. The 500ms tick loop reads this and drives ongoing behaviour (pathfinding, mining, combat). MCP tool handlers write to it. Persists across `claude -p` invocations because the bot process is long-lived. Values: `idle`, `navigate`, `follow`, `mine`, `collect`, `attack`.

**Agent runner** — The bash script `agent/run.sh` that polls `chat-queue.txt` every 500ms and invokes `claude -p` when content is found. Owned by Terminal 3. One invocation per message; a lockfile prevents concurrency.

**Bot process** — The Node.js process started by `node bot/index.js`. Runs continuously (Terminal 2). Hosts three servers simultaneously: the Mineflayer Minecraft client, the MCP HTTP server on `:8888`, and the dashboard HTTP server on `:8889`.

**Chat queue** — `bot/chat-queue.txt`. A plain text file used as a single-reader, single-writer FIFO queue between the bot process and the agent runner. The bot appends lines; the runner reads and clears the file.

**Claude Code headless** — Claude Code CLI (`claude`) running in print mode (`-p`), invoked non-interactively by a script. No terminal UI. Accepts a prompt string and exits after completing the agentic loop.

**ClaudeBot** — The Mineflayer bot's in-game username. Appears as a player in the Minecraft world with coordinates, health, and inventory. Controlled entirely by the bot process and Claude tool calls.

**Dashboard** — A browser UI served at `http://127.0.0.1:8889` by the bot process. Shows ClaudeBot's live position, health, food, current task, and a chat log. Accepts `@claude` commands without needing to be in the Minecraft game client.

**Headless** — Running without a user-facing interface. `claude -p` is headless Claude Code: no interactive terminal, no human in the loop, driven entirely by a script.

**Lockfile** — `agent/claude-busy.lock`. A file created before a `claude -p` invocation and deleted after. Prevents the runner from starting a second invocation while one is in progress. Auto-removed after 60 seconds if stale (crash guard).

**MCP (Model Context Protocol)** — Anthropic's open protocol for connecting LLMs to external tools. Claude Code acts as an MCP client; `bot/mcp-server.js` acts as an MCP server. Claude discovers the 11 available tools at session start and calls them to act in the game.

**MCP session** — A stateful HTTP connection between `claude -p` and the MCP server. Created on each `claude -p` invocation, destroyed when Claude exits. The bot process and its state persist across sessions.

**Mineflayer** — A Node.js library (`mineflayer`) that implements the Minecraft Java Edition protocol. It connects to the Paper server as a fake player, sends/receives game packets, and exposes a high-level API for movement, inventory, chat, and block interaction.

**Paper** — The Minecraft server implementation used by this project. Paper is a performance-optimised fork of CraftBukkit. Runs at `server/`. Version: `1.21.11`.

**Pathfinder** — The `mineflayer-pathfinder` plugin loaded into the Mineflayer bot. Handles A* navigation: given a goal (coordinates, entity to follow, block to reach), it finds a walkable path and moves the bot there.

**Peaceful difficulty** — Minecraft difficulty setting with no hostile mob spawning. Set on this server to prevent ClaudeBot from being killed by zombies, skeletons, or creepers while idle.

**Print mode** — The `claude -p` flag. Runs Claude Code non-interactively: takes a prompt, runs the agentic loop including tool calls, prints the final response, and exits.

**Server** — The Paper Minecraft Java server running at `server/`. Accepts connections on port `25565`. Runs in offline mode (no Mojang account required to connect) with forced survival gamemode.

**Streamable HTTP transport** — The MCP transport used by this project. Claude's MCP client sends `POST /mcp` requests; the server responds with JSON or SSE. Requires `{ "type": "http", "url": "..." }` in `mcp-config.json`. The older SSE-only transport is deprecated and will not work.

**Tick loop** — A `setInterval` callback in `bot/index.js` that fires every 500ms while the bot is connected. Executes the current `activeTask`: updates pathfinder goals for `follow`, calls `executeMineTask` for `mine`, `executeCollectTask` for `collect`, and `executeAttackTask` for `attack`.

**Waypoint** — A named geographic position saved to `bot/waypoints.json`. Created with `save_waypoint`, navigated to with `goto_waypoint`. Waypoints persist across bot and agent restarts and are displayed in the dashboard's Waypoints panel.

**FOOD_PRIORITY** — An ordered list of Minecraft food item names used by `eat_food` when no specific food is requested. Items are ordered by effective quality (foodPoints + saturation), from best (enchanted golden apple, golden carrot) to worst (rotten flesh, spider eye).
