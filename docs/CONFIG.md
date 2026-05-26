# Configuration

File: [`manager-config.json`](../manager-config.json) at the project root.

## Schema

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `port` | number | `8080` | Dashboard HTTP port |
| `paths.serverCore` | string | `./server-core` | Bedrock server folder (`bedrock_server.exe` lives here) |
| `paths.backups` | string | `./backups` | Backup zip output directory |
| `paths.updateDrop` | string | `./update-drop` | Drop folder for update zips |
| `server.executable` | string | `bedrock_server.exe` | Process to spawn |
| `server.stopCommand` | string | `stop` | Written to stdin for graceful stop |
| `server.gracefulTimeoutMs` | number | `30000` | Wait before force kill |
| `server.forceKillTimeoutMs` | number | `10000` | Additional kill delay |
| `protected` | string[] | see defaults | Path patterns skipped during update extract |

Missing keys are merged with defaults in [`src/config/schema.js`](../src/config/schema.js).

## Windows paths

Use forward slashes in JSON:

```json
"serverCore": "C:/Users/you/DevServer"
```

Backslashes break JSON unless escaped (`\\`).

## Future: multiple servers

Not implemented yet. A future layout might look like:

```json
"servers": [
  { "id": "main", "serverCore": "C:/BDS/main", "port": 8080 }
]
```

The app context is designed so each server could get its own service set later.
