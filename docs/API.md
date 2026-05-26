# HTTP API

Base path: `/api`

All response types and endpoint request/response shapes are defined in [`shared/`](../shared/), which serves as the single source of truth consumed by both the server and the frontend dashboard.

## Response formats

### Legacy (most endpoints today)

Many endpoints return domain JSON directly, for example:

```json
{ "running": true, "state": "running", "pid": 1234 }
```

Errors may use:

```json
{ "error": "Human-readable message" }
```

### Standard envelope (new endpoints / errors from middleware)

Success:

```json
{ "success": true, "data": { } }
```

Failure:

```json
{
  "success": false,
  "error": "Human-readable message",
  "errorDetail": { "message": "Human-readable message", "code": "ERROR_CODE" }
}
```

The dashboard `api` client accepts both shapes.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/status` | Server process status + `operationActive` |
| GET | `/validate` | Whether `bedrock_server.exe` exists in `serverCore` |
| GET | `/info` | Dashboard port, LAN hosts, Minecraft port |
| GET | `/server/logs?lines=200` | Tail of server stdout/stderr buffer |
| GET | `/server/logs/stream` | SSE live log stream (`event: log`) |
| POST | `/server/start` | Start BDS (blocked while update/restore runs) |
| POST | `/server/stop` | Stop BDS (blocked while update/restore runs) |
| POST | `/server/command` | Body `{ "command": "list" }` — generic console escape hatch |
| GET | `/server/gamerules` | Gamerule catalog + current values when server is running |
| PUT | `/server/gamerules` | Body `{ "rule", "value" }` — set gamerule (server must be running) |
| POST | `/server/actions` | Body `{ "action": "tp"\|"give"\|"kill", "target", ... }` — validated player actions |
| GET | `/update/check` | List `.zip` files in update-drop |
| POST | `/update/upload` | Multipart field `zip` |
| POST | `/update/execute` | Body `{ "filename": "optional.zip" }` → `{ eventStream }` |
| GET | `/update/events?path=...` | SSE progress (`step`, `complete`, `error`) |
| GET | `/backups` | List backup archives |
| POST | `/backups/create` | Create manual backup zip |
| POST | `/backups/restore` | Body `{ "name": "backup_....zip" }` — stops server, extracts backup |
| DELETE | `/backups/:name` | Delete a backup archive |
| GET | `/config` | Current `manager-config.json` + resolved paths + validation |
| PUT | `/config` | Save config; returns `{ requiresRestart, config, resolvedPaths }` |
| GET | `/properties` | Parsed `server.properties` (editable keys listed) |
| PUT | `/properties` | Body `{ "updates": { "server-port": "19132", ... } }` — server must be stopped |
| GET | `/players` | Merged roster + maxPlayers from `server.properties` |
| POST | `/players/kick` | Body `{ "name": "player" }` |
| POST | `/players/op` | Body `{ "name": "player" }` |
| POST | `/players/deop` | Body `{ "name": "player" }` |
| GET | `/players/permissions` | Raw + parsed `permissions.json` |
| PUT | `/players/permissions` | Full document replace (server stopped) |
| GET | `/players/allowlist` | Raw + parsed `allowlist.json` |
| PUT | `/players/allowlist` | Full document replace (server stopped) |
| GET | `/players/banlist` | Raw + parsed `banlist.json` |
| PUT | `/players/banlist` | Full document replace (server stopped) |
| POST | `/players/ban` | Body `{ "name", "reason?" }` — console when running, file when stopped |
| POST | `/players/pardon` | Body `{ "name" }` |
| GET | `/players/temp-bans` | Overlay temp-ban list |
| POST | `/players/temp-ban` | Body `{ "name", "durationMinutes", "reason?", "xuid?" }` |
| DELETE | `/players/temp-ban/:name` | Remove temp ban + pardon |
| POST | `/players/temp-bans/check-expiry` | Process expired temp bans |
| GET | `/players/whitelist-mode` | `{ "enabled": boolean }` from `allow-list` property |
| POST | `/players/whitelist-mode` | Body `{ "enabled", "sync?" }` — server stopped |
| POST | `/players/allowlist/import` | Body `{ "format": "csv"\|"lines", "content", "apply?" }` — preview or apply |
| POST | `/players/permissions/apply-template` | Body `{ "playerName", "template" }` — server stopped |
| GET | `/players/notes/:key` | Manager-data player notes |
| PUT | `/players/notes/:key` | Body `{ "notes" }` |
| GET | `/players/history?search=&limit=` | Join/leave history from log capture |
| GET | `/packs` | Installed behavior + resource packs + enabled status |
| GET | `/packs/drop` | Scan `packDrop/behavior` and `packDrop/resource` |
| POST | `/packs/install` | Multipart field `pack` — server stopped |
| POST | `/packs/enable` | Body `{ "packId", "type" }` — server stopped |
| POST | `/packs/disable` | Body `{ "packId", "type" }` — server stopped |
| DELETE | `/packs/:type/:packId` | Remove pack — server stopped |
| GET | `/packs/conflicts` | Duplicate UUID scan |
| GET | `/packs/deps` | `min_engine_version` warnings |
| POST | `/packs/replace` | Body `{ "packId", "type" }` — replace from drop folder |
| GET | `/packs/worlds` | Per-world pack JSON for all worlds |
| GET | `/packs/world/:worldName` | Pack JSON for one world |
| GET | `/worlds` | List worlds + active world |
| POST | `/worlds/activate` | Body `{ "name" }` — server stopped |
| POST | `/worlds/rename` | Body `{ "from", "to" }` — server stopped |
| DELETE | `/worlds/:name` | Body `{ "confirmName", "backup?" }` — server stopped |
| GET | `/worlds/:name/export` | Download world zip |
| POST | `/worlds/import` | Multipart `world`; query `name`, `overwrite`, `backup` — server stopped |
| POST | `/worlds/:name/reset-dimension` | Body `{ "dimension": "nether"\|"end", "backup?" }` — server stopped |
| GET | `/worlds/:name/level` | Read-only level.dat + properties overlap |
| GET | `/system/metrics` | Current hardware + BDS process snapshot |
| GET | `/system/metrics/stream` | SSE every 2s (`event: metrics`) |

## SSE events

### Update pipeline (`/update/events`)

- `step` — pipeline progress
- `complete` — success payload with `backupName`, `filesExtracted`, `filesSkipped`
- `error` — failure payload with `message`, optional `backupName`

### Server logs (`/server/logs/stream`)

- `log` — `{ "data": "line text" }`

### System metrics (`/system/metrics/stream`)

- `metrics` — `MetricsSnapshot` with host CPU/RAM, disk, BDS process stats, player count

> **Note:** Type definitions for all request/response payloads and SSE event shapes derive from [`shared/`](../shared/). See `shared/api.ts`, `shared/pipeline.ts`, `shared/server.ts`, `shared/config-api.ts`, `shared/properties.ts`, `shared/logs.ts`, `shared/players.ts`, `shared/packs.ts`, `shared/worlds.ts`, `shared/gamerules.ts`, `shared/commands.ts`, `shared/system.ts`, etc.
