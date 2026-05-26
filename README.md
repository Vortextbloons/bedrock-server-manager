# Bedrock Server Manager

Manual-trigger Bedrock Dedicated Server manager with local web dashboard (Windows-focused).

---

## Features

- **Server control** -- Start/stop the Bedrock Dedicated Server, view live logs via Server-Sent Events (SSE).
- **Manual BDS update pipeline** -- Drop a BDS zip into the update drop folder; the manager backs up the current installation, extracts the new version, and preserves protected paths (worlds, config, allowlist, permissions, known packs).
- **Backups management** -- Create, restore, and delete backups of the full server-core directory.
- **Server properties editor** -- Read and edit `server.properties` from the dashboard.
- **Players view** -- Browse connected player history and online status.
- **Whitelist (Allowlist) management** -- View, add, and remove players from the allowlist.
- **Permissions management** -- View and edit operator permissions.
- **Ban & temp-ban management** -- View, add, remove, and expire bans.
- **World management** -- List worlds, activate a world, rename, delete, export, import, and reset Nether/End dimensions.
- **Pack management** -- Install behavior/resource packs from a drop folder, enable/disable packs, replace existing packs, detect conflicts.
- **Real-time system metrics** -- CPU, RAM, disk usage, and BDS process health displayed live on the dashboard.

---

## Prerequisites

- **Node.js 20+** (npm is included with Node.js)
- **Windows OS** -- Required; `bedrock_server.exe` is a Windows binary.
- **An existing Minecraft Bedrock Dedicated Server installation folder** -- The server-core directory that contains `bedrock_server.exe`, `worlds/`, `server.properties`, etc.

---

## Quick Start

```powershell
# Clone and install
git clone https://github.com/<your-username>/bedrock-server-manager.git
cd bedrock-server-manager
npm install

# Create local config from the example
# Windows PowerShell:
Copy-Item manager-config.example.json manager-config.json
# Or Command Prompt:
copy manager-config.example.json manager-config.json

# Edit manager-config.json -- set paths.serverCore to your BDS folder
# e.g. "C:/Users/you/DevServer"

# Build backend and frontend, then start
npm run build:all
npm start

# Open http://localhost:8080 in your browser
```

> **Note:** The first start will create the configured directories if they don't exist (backups, update-drop, pack-drop, manager-data).

---

## Configuration

Full configuration schema, all available fields, and Windows path notes are documented in the [Configuration Guide](docs/CONFIG.md).

Key settings in `manager-config.json`:

| Field | Description |
|---|---|
| `port` | HTTP port for the dashboard (default `8080`) |
| `paths.serverCore` | Path to your BDS installation folder |
| `paths.backups` | Directory where backups are stored |
| `paths.updateDrop` | Drop BDS zip files here to trigger an update |
| `paths.packDrop` | Drop behavior/resource packs here to install |
| `server.executable` | Name of the BDS executable (`bedrock_server.exe`) |
| `server.stopCommand` | Console command sent to stop the server (`stop`) |
| `server.gracefulTimeoutMs` | Milliseconds to wait for graceful shutdown |
| `server.forceKillTimeoutMs` | Extra time before force-killing the process |
| `protected` | Paths (relative to serverCore) preserved during updates |

---

## Development

```bash
npm run dev           # Backend with hot-reload (tsx watch)
npm run dev:client    # Frontend dev server (Vite, opens browser)
npm run typecheck     # Type-check both backend and frontend
npm run test          # Run tests (tsx --test)
npm run build:all     # Build backend + frontend for production
```

---

## Documentation

- [API Reference](docs/API.md) -- Full HTTP API endpoint documentation, request/response shapes, and WebSocket/SSE events. All types are shared between server and client via the `shared/` module.
- [Architecture Guide](docs/ARCHITECTURE.md) -- Project layout, data flow between server and client, dependency injection, and extension guide.
- [Configuration Guide](docs/CONFIG.md) -- Config schema, default values, and Windows path notes.

---

## Security

**Local use only.** The dashboard has no built-in authentication. Do not expose port 8080 to the internet without a reverse proxy and authentication layer in front of it. The `/api/info` and `/api/config` endpoints expose resolved file paths and LAN addresses.

---

## License

MIT
