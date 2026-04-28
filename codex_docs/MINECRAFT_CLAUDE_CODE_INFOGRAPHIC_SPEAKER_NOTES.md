# Speaker Notes for the Minecraft + Claude Code Infographic

Audience assumption: people understand Claude Code and tool use, but they do not need prior Minecraft experience.

Infographic: `minecraft_claude_code_anatomy_infographic.svg`

## Opening Frame

Use this framing before walking through the diagram:

"The main thing to understand is that Claude is not literally installed inside Minecraft. Minecraft is just running a local game server. Claude Code is outside the game, running as a headless CLI agent. The bridge between them is a normal software integration: a bot client logs into Minecraft, and Claude controls that bot through MCP tools."

"So when it looks like Claude is walking around, following a player, or mining a block, what is really happening is: Claude makes a tool call, Node.js receives it, Mineflayer turns it into Minecraft client actions, and the Minecraft server updates the bot's player entity."

## Read the Diagram in One Sentence

"Read the diagram clockwise: the human types into Minecraft, a Mineflayer bot captures addressed chat, a queue wakes up `claude -p`, Claude calls MCP tools, those tools manipulate the live bot, and the Minecraft world shows the result."

## 1. Minecraft World

Point to: `1. Minecraft World`

"This first box is the game world. If you have never played Minecraft, think of it as a shared 3D sandbox running on a server. Players connect to the server, appear as characters, move around, chat, collect resources, and change the world."

"In this project the server is local. It is a Paper Minecraft server bound to `127.0.0.1:25565`, so it is not a public cloud service. The human player connects to it from Minecraft Java Edition, and the bot connects to the same address as another player."

"This matters because the integration does not require a custom Minecraft server plugin. The server is just hosting a world and accepting player connections."

Optional detail:

"The server is configured in offline mode for the local demo, which is why a script can log in as `ClaudeBot` without a Microsoft account authentication flow. That is convenient locally, but not a production security setup."

## 2. Mineflayer Body

Point to: `2. Mineflayer Body`

"This is the most important mental model: Mineflayer gives Claude a body."

"Mineflayer is a Node.js library that can connect to a Minecraft server as if it were a regular player client. The project creates a bot named `ClaudeBot`. To Minecraft, `ClaudeBot` is a normal player entity. It has a position, health, hunger, inventory, and can send chat messages."

"Claude does not see pixels from Minecraft here. It does not operate a game window. Instead, Mineflayer maintains structured game state: coordinates, nearby entities, nearby blocks, inventory items, and player names."

"That is the first part of the magic: replace visual game control with a programmatic player body."

Bridge sentence:

"At this point we have a Minecraft player controlled by Node.js, but not yet by Claude. The next boxes explain how chat wakes Claude up."

## 3. Chat Queue

Point to: `3. Chat Queue`

"When a human types in Minecraft chat, all connected clients can receive that message. `ClaudeBot` listens for chat. It ignores most chat, but if a message contains `@claude` or `@team`, the bot treats it as an instruction."

"Instead of immediately asking Claude through an API call inside the bot process, this project writes the addressed message into a plain file: `bot/chat-queue.txt`."

"This is intentionally simple. The queue file is the handoff between the always-running Minecraft bot and the headless Claude runner."

Example:

"If the player types `@claude follow me`, the bot appends a line like `YourUsername: @claude follow me` to the queue."

Key clarification:

"The queue does not make decisions. It just records that there is work for Claude to process."

## 4. Claude Runner

Point to: `4. Claude Runner`

"This box is familiar if you know Claude Code. The runner is a script that polls the queue file. When it sees a command, it launches Claude Code in headless mode with `claude -p`."

"The runner supplies three important pieces of context."

"First, it passes the user's Minecraft chat message as the prompt."

"Second, it appends `agent/prompt.md`, which tells Claude: you are ClaudeBot, always call `get_status` first, keep Minecraft chat short, and use the Minecraft tools for actions."

"Third, it passes `agent/mcp-config.json`, which points Claude Code at a local MCP server."

Suggested wording:

"So this is not a persistent conversational Claude sitting inside Minecraft. It is a fresh headless Claude Code turn triggered by a chat message."

Important tradeoff:

"That keeps the demo simple and robust. But it also means long-term memory is not automatic. The persistent part is the Minecraft bot process and the game world, not the Claude process."

## 5. MCP Bridge

Point to: `5. MCP Bridge`

"This is the actual doorway between Claude Code and Minecraft."

"The MCP server runs inside the same Node.js process as the Mineflayer bot. It listens locally at `127.0.0.1:8888/mcp`. Claude Code connects to it because the runner provides an MCP config."

"From Claude's perspective, this looks like any other MCP server. It discovers tools with names like `get_status`, `navigate_to`, `follow_player`, `mine_block`, and `send_chat`."

"From Node's perspective, those tools are just JavaScript functions with access to the live Mineflayer bot object."

Core line:

"MCP is the nervous system: Claude's intentions travel across MCP as tool calls, and the Node process turns them into game actions."

## 6. Tool Handlers

Point to: `6. Tool Handlers`

"The tool handlers are the verbs Claude is allowed to use in Minecraft."

"For example, `get_status` returns the bot's coordinates, health, food, current task, and nearby players. `send_chat` makes the bot say something in Minecraft chat. `follow_player` sets a pathfinding goal to stay near a named player. `mine_block` starts a background mining task for a block type like `oak_log` or `stone`."

"This is important for a Claude Code audience: Claude is not given raw unrestricted access to the Minecraft network protocol. It is given a small, typed API. That API defines what kind of agency the bot actually has."

Example walkthrough:

"For `@claude follow me`, Claude calls `get_status`, sees the nearby player, calls `follow_player`, then calls `send_chat` to say something like `Following you`."

"The human experiences that as Claude understanding the command and moving in the world. Technically, it is tool calling plus Mineflayer pathfinding."

## Optional Dashboard

Point to: `Optional Dashboard`

"This side box is not essential to the magic, but it is useful for demos. The dashboard is a browser UI on `127.0.0.1:8889`."

"It shows bot status and chat, and it can write commands into the same queue file. That means you can test the Claude loop even without typing inside the Minecraft client."

Clarification:

"In-game chat and dashboard commands converge on the same queue. After that, the path through Claude and MCP is the same."

## Follow the Arrows

Use this section to narrate the full loop.

### Arrow A: Minecraft World to Mineflayer Body

"The human and `ClaudeBot` are both connected to the same Minecraft server. When the human chats or moves, the bot client can observe the relevant game state."

### Arrow B: Mineflayer Body to Chat Queue

"The bot filters chat. Only addressed messages are written into the queue."

### Arrow C: Chat Queue to Claude Runner

"The runner sees work, locks the queue, clears it, and launches `claude -p` for one headless turn."

### Arrow D: Claude Runner to MCP Bridge

"Claude starts with the MCP config, connects to the local Minecraft MCP server, and discovers the available tools."

### Arrow E: MCP Bridge to Tool Handlers

"When Claude chooses a tool, the MCP server routes that call to the matching JavaScript handler."

### Arrow F: Tool Handlers to Mineflayer Body

"The handler touches the live bot: set a pathfinding goal, inspect inventory, dig a block, or send chat."

### Arrow G: Mineflayer Body to Minecraft World

"Mineflayer sends normal Minecraft client packets back to the server. The server updates the world, so the human sees `ClaudeBot` move or chat."

## Demo Script: One Concrete Command

Use this if explaining live:

"Let's trace `@claude come to -1.5 66 1.5`."

1. "The human sends that text in Minecraft chat."
2. "`ClaudeBot`, the Mineflayer client, receives the chat event."
3. "The bot sees `@claude`, so it appends the message to `chat-queue.txt`."
4. "The runner launches `claude -p` with the message and the Minecraft MCP config."
5. "Claude calls `get_status` first, because the system prompt tells it to orient itself."
6. "Claude decides this is a navigation request."
7. "Claude calls `navigate_to` with x, y, z coordinates."
8. "The Node tool handler sets a Mineflayer pathfinder goal."
9. "Mineflayer walks the `ClaudeBot` entity through the Minecraft world."
10. "Claude calls `send_chat`, so the bot says a short confirmation in-game."

Closing sentence:

"That is the whole illusion: natural language becomes a Claude tool call, and the tool call becomes Minecraft movement."

## What Makes It Feel Magical

"The magic feeling comes from three layers lining up cleanly."

"First, Minecraft gives us a shared world where actions are visible."

"Second, Mineflayer gives us a programmable player body inside that world."

"Third, Claude Code plus MCP gives us a reasoning agent that can choose actions using natural language."

"None of the individual pieces is mysterious. The surprising part is the composition: a CLI coding agent can feel embodied if the environment exposes the right tools."

## What This Is Not

Use this to prevent misunderstandings:

"This is not Claude visually watching a Minecraft screen."

"This is not a Minecraft mod that embeds an LLM in the game server."

"This is not the Claude desktop app controlling keyboard and mouse."

"This is not a fully autonomous survival player yet."

"It is a local agent bridge: chat trigger, headless Claude Code, MCP tools, Mineflayer body."

## Current Limitations to Mention

"The prototype is intentionally narrow."

"It can navigate, follow, chat, inspect nearby blocks and entities, mine blocks, collect dropped items, and inspect inventory."

"It does not yet have reliable high-level Minecraft skills like crafting, building a house, equipping tools, fighting, placing blocks, or handing an item directly to the human."

"For example, `bring me a log` is semantically simple but mechanically incomplete unless the bot can mine, collect, navigate back, and drop the item. The current tool set covers some of that path, but not a clean explicit item handoff."

## Strong Closing

"The important engineering pattern is portable. Minecraft is just the demo world. The real pattern is: take an environment, expose state and actions as MCP tools, and let a headless Claude Code turn decide which tools to call."

"In this project, the environment is Minecraft, the body is Mineflayer, the trigger is chat, and the control protocol is MCP. That is how Claude Code appears to get into the game."
