# Chat commands

Everything you can say to ClaudeBot. Commands work identically whether typed in Minecraft game chat (press T) or in the dashboard input box.

## Trigger words

ClaudeBot only reacts to messages containing `@claude` or `@team` (case-insensitive). Normal chat is ignored.

```
@claude follow me        ✓ triggers ClaudeBot
@team come here          ✓ triggers ClaudeBot
hello everyone           ✗ ignored
```

---

## Navigation

| Command | What ClaudeBot does |
|---------|---------------------|
| `@claude follow me` | Follows you continuously until stopped |
| `@claude come to me` | Pathfinds to your current location once |
| `@claude come to -6 64 152` | Pathfinds to those coordinates |
| `@claude come to -6, 64, 152` | Same — commas are parsed flexibly |
| `@claude stop` | Stops all movement and tasks |
| `@team stop` | Same as above |

> **Tip:** Press F3 in Minecraft to see your current coordinates. Use them to direct ClaudeBot to your exact location.

---

## Mining and resources

| Command | What ClaudeBot does |
|---------|---------------------|
| `@claude mine 5 oak_log` | Mines 5 oak logs from nearby trees |
| `@claude mine 10 stone` | Mines 10 stone blocks |
| `@claude mine some coal` | Mines 1 coal_ore (approximate commands work) |
| `@claude what is in your inventory` | Reports current inventory contents |
| `@claude collect nearby items` | Walks to and picks up dropped item entities |
| `@claude bring the logs to me` | Claude checks inventory and pathfinds to you |

> **Note:** Mining only works in survival mode. Use `/gamemode survival` if items aren't appearing in inventory.

---

## Scouting and information

| Command | What ClaudeBot does |
|---------|---------------------|
| `@claude what do you see around you` | Reports nearby blocks and entities |
| `@claude look for oak trees` | Scans for oak_log blocks within 32 blocks |
| `@claude find sheep nearby` | Scans for sheep entities within 32 blocks |
| `@claude get status` | Reports position, health, food, and current task |
| `@claude where are you` | Reports current coordinates |
| `@team explore north` | Claude scans in that direction and reports |

---

## Example session

```
You:        @claude follow me
ClaudeBot:  Following YourUsername

[you fly to a forest]

You:        @claude stop
ClaudeBot:  Stopped

You:        @claude what do you see around you
ClaudeBot:  Oak x117, Birch x23. You nearby. Full health, idle.

You:        @claude mine 5 oak_log
ClaudeBot:  Mining 5 oak_log

[~2 minutes pass]

ClaudeBot:  Done mining 5 oak_log

You:        @claude what is in your inventory
ClaudeBot:  oak_log x5

You:        @claude bring them to me
ClaudeBot:  Coming to you now!
```

---

## Tips

**Be near the resources.** ClaudeBot searches within 32 blocks by default. If you ask it to find sheep and there are none nearby, it will say so. Fly to where the resources are, then issue the command.

**Commands are processed one at a time.** If you send two commands quickly, the second queues behind the first. ClaudeBot will process them in order.

**Natural language works.** Claude is the interpreter — you don't need exact syntax. `@claude please go get some wood from that tree over there` works the same as `@claude mine 1 oak_log`.

**Check the dashboard for replies.** Minecraft chat fades after 10 seconds. The dashboard at `http://127.0.0.1:8889` keeps a permanent scrollable log.
