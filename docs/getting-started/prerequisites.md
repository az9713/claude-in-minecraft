# Prerequisites

Everything you need before running the system.

---

### Java 21+

Required by the Paper Minecraft server.

```bash
java -version
# Expected: openjdk 21.x.x or higher (Java 23 is fine)
```

Install: [adoptium.net](https://adoptium.net) or `winget install EclipseAdoptium.Temurin.21.JDK`

---

### Node.js 22 LTS

Required by the bot process and dashboard.

```bash
node --version
# Expected: v22.x.x
```

Install: [nodejs.org](https://nodejs.org) or `winget install OpenJS.NodeJS.LTS`

---

### Claude Code CLI

Required by the agent runner. Must be authenticated.

```bash
claude --version
# Expected: 2.x.x

claude auth status
# Expected: logged in
```

Install: [claude.ai/code](https://claude.ai/code)

---

### Git Bash (Windows)

The agent runner (`run.sh`) uses bash. On Windows, Git Bash provides bash.

```bash
bash --version
# Expected: GNU bash, version 5.x
```

Install: [git-scm.com](https://git-scm.com/downloads)

---

### Minecraft Java Edition 1.21.11

Required to play alongside ClaudeBot visually. The server runs in offline mode so any launcher that supports version 1.21.11 works.

> **Note:** The dashboard at `http://127.0.0.1:8889` lets you send commands without a Minecraft client. You only need the game to see ClaudeBot move.

---

### Hardware (verified working)

| Component | Minimum | This project tested on |
|-----------|---------|------------------------|
| RAM | 8 GB | 32 GB |
| CPU | 4-core | i5-12450H 8-core |
| GPU | Any (for Minecraft client) | RTX 3050 |
| Disk | 4 GB free | 305 GB free |
| OS | Windows 10 / macOS 12 / Ubuntu 20.04 | Windows 11 |
