# Minecraft Headless Claude Agent

A system that runs Claude Code as a headless AI agent inside Minecraft — ClaudeBot joins your private server as a playable character and responds to natural-language commands typed in game chat.

---

## Documentation

| Section | What's inside |
|---------|--------------|
| [Overview](overview/what-is-this.md) | Mental model, architecture diagram, how the pieces connect |
| [Key concepts](overview/key-concepts.md) | Definitions for every term used across the docs |
| [Prerequisites](getting-started/prerequisites.md) | Software requirements with verify commands |
| [Quickstart](getting-started/quickstart.md) | Running the full system in under 15 minutes |
| [Onboarding](getting-started/onboarding.md) | Zero-to-hero guide for newcomers |
| [Bot & MCP server](concepts/bot-and-mcp.md) | How Mineflayer and the MCP server work |
| [Agent runner](concepts/agent-runner.md) | How the polling loop dispatches Claude |
| [Dashboard](concepts/dashboard.md) | The live web UI at port 8889 |
| [Combat](concepts/combat.md) | How `attack_entity` works — entity tracking, tick loop, melee |
| [Crafting & building](concepts/crafting-and-building.md) | `craft_item` and `place_block` — recipes, table navigation, face probing |
| [Waypoints](concepts/waypoints.md) | Named persistent locations — storage, navigation, dashboard display |
| [Survival tools](concepts/survival-tools.md) | `eat_food` and `drop_item` — food priority, inventory management |
| [MCP tools reference](reference/mcp-tools.md) | All 20 tools Claude can call |
| [Configuration reference](reference/configuration.md) | Every config file and option |
| [Chat commands](reference/chat-commands.md) | What to type to control ClaudeBot |
| [Testing new features](guides/testing-new-features.md) | Step-by-step verification for combat, crafting, building, waypoints, survival |
| [System design](architecture/system-design.md) | Component breakdown, data flows, dependencies |
| [Architecture decisions](architecture/adr/) | Why non-obvious choices were made |
| [Troubleshooting](troubleshooting/common-issues.md) | Top failures and exact fixes |

> **New here?** Start with [what is this](overview/what-is-this.md), then run the [quickstart](getting-started/quickstart.md).
