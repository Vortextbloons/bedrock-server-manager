import express from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { json, fail } from '../http';
import { requireIdle, requireServerStopped } from '../middleware/operation-lock';
import { ServerProcess } from '../../server-process';
import { getCommandService } from '../../command-service';
import { processExpiredTempBans } from '../../temp-ban-expiry';
import {
  getMergedPlayers,
  kick,
  op,
  deop,
  getPermissions,
  writePermissions,
  getAllowlist,
  writeAllowlist,
  getMaxPlayers,
  getBanlist,
  writeBanlist,
  addBanEntry,
  removeBanEntry,
  readTempBans,
  addTempBan,
  removeTempBan,
  getPlayerNote,
  writePlayerNote,
  getPlayerHistory,
  getWhitelistMode,
  syncAllowlistRoster,
  previewBulkImport,
  applyBulkImport,
  applyPermissionTemplate,
} from '../../player-service';
import { writeProperties } from '../../properties-service';
import type { AppContext } from '../../app-context';
import type {
  KickRequest,
  OpRequest,
  DeopRequest,
  PermissionsPutRequest,
  AllowlistPutRequest,
  TempBanOverlay,
  TemplateName,
} from '../../../shared/players';

function createPlayersRouter(ctx: AppContext): express.Router {
  const router = express.Router();
  const blockWhileRunning = requireIdle(ctx, ['update', 'restore']);
  const stopRequired = requireServerStopped(ctx);

  router.get(
    '/players',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess') as unknown as ServerProcess;
      const players = await getMergedPlayers(server);
      const maxPlayers = getMaxPlayers();
      json(res, { players, maxPlayers });
    }),
  );

  router.post(
    '/players/kick',
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const { name } = req.body as KickRequest;
      if (!name || typeof name !== 'string') {
        return fail(res, 400, 'Missing name', 'INVALID_BODY');
      }
      const server = ctx.getService('serverProcess') as unknown as ServerProcess;
      await kick(name, server);
      json(res, { success: true });
    }),
  );

  router.post(
    '/players/op',
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const { name } = req.body as OpRequest;
      if (!name || typeof name !== 'string') {
        return fail(res, 400, 'Missing name', 'INVALID_BODY');
      }
      const server = ctx.getService('serverProcess') as unknown as ServerProcess;
      await op(name, server);
      json(res, { success: true });
    }),
  );

  router.post(
    '/players/deop',
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const { name } = req.body as DeopRequest;
      if (!name || typeof name !== 'string') {
        return fail(res, 400, 'Missing name', 'INVALID_BODY');
      }
      const server = ctx.getService('serverProcess') as unknown as ServerProcess;
      await deop(name, server);
      json(res, { success: true });
    }),
  );

  router.get(
    '/players/permissions',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      json(res, getPermissions());
    }),
  );

  router.put(
    '/players/permissions',
    blockWhileRunning,
    stopRequired,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const { content } = req.body as PermissionsPutRequest;
      if (!Array.isArray(content)) {
        return fail(res, 400, 'Content must be an array', 'INVALID_BODY');
      }
      json(res, writePermissions(content));
    }),
  );

  router.get(
    '/players/allowlist',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      json(res, getAllowlist());
    }),
  );

  router.put(
    '/players/allowlist',
    blockWhileRunning,
    stopRequired,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const { content } = req.body as AllowlistPutRequest;
      if (!Array.isArray(content)) {
        return fail(res, 400, 'Content must be an array', 'INVALID_BODY');
      }
      json(res, writeAllowlist(content));
    }),
  );

  router.get('/players/banlist', asyncHandler(async (_req, res) => {
    json(res, getBanlist());
  }));

  router.put('/players/banlist', blockWhileRunning, stopRequired, asyncHandler(async (req, res) => {
    const { content } = req.body as { content?: unknown };
    if (!Array.isArray(content)) return fail(res, 400, 'Content must be an array', 'INVALID_BODY');
    json(res, writeBanlist(content));
  }));

  router.post('/players/ban', asyncHandler(async (req, res) => {
    const { name, reason } = req.body as { name?: string; reason?: string };
    if (!name) return fail(res, 400, 'Missing name', 'INVALID_BODY');
    try {
      const server = ctx.getService('serverProcess') as unknown as ServerProcess;
      if (server.getStatus().running) {
        const cmd = getCommandService(server);
        await cmd.ban(name, reason);
        try {
          addBanEntry(name, reason);
        } catch (e) {
          if (!(e as Error).message.includes('already banned')) throw e;
        }
      } else {
        addBanEntry(name, reason);
      }
      json(res, { success: true });
    } catch (e) {
      return fail(res, 400, (e as Error).message, 'BAN_FAILED');
    }
  }));

  router.post('/players/pardon', asyncHandler(async (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name) return fail(res, 400, 'Missing name', 'INVALID_BODY');
    try {
      const server = ctx.getService('serverProcess') as unknown as ServerProcess;
      if (server.getStatus().running) {
        const cmd = getCommandService(server);
        await cmd.pardon(name);
      }
      removeBanEntry(name);
      json(res, { success: true });
    } catch (e) {
      return fail(res, 400, (e as Error).message, 'PARDON_FAILED');
    }
  }));

  router.get('/players/temp-bans', asyncHandler(async (_req, res) => {
    json(res, { bans: readTempBans() });
  }));

  router.post('/players/temp-ban', asyncHandler(async (req, res) => {
    const { name, xuid, reason, durationMinutes } = req.body as {
      name?: string; xuid?: string; reason?: string; durationMinutes?: number;
    };
    if (!name || !durationMinutes) return fail(res, 400, 'Missing name or durationMinutes', 'INVALID_BODY');

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
    const overlay: TempBanOverlay = { name, reason, expiresAt };
    if (xuid) overlay.xuid = xuid;

    const server = ctx.getService('serverProcess') as unknown as ServerProcess;
    if (server.getStatus().running) {
      const cmd = getCommandService(server);
      await cmd.ban(name, reason);
    }
    try {
      addBanEntry(name, reason);
    } catch (e) {
      if (!(e as Error).message.includes('already banned')) throw e;
    }
    addTempBan(overlay);
    json(res, { success: true, expiresAt });
  }));

  router.delete('/players/temp-ban/:name', asyncHandler(async (req, res) => {
    const name = req.params.name as string;
    const server = ctx.getService('serverProcess') as unknown as ServerProcess;
    if (server.getStatus().running) {
      try {
        const cmd = getCommandService(server);
        await cmd.pardon(name);
      } catch {
        // ignore console errors; still clear files
      }
    }
    removeTempBan(name);
    try { removeBanEntry(name); } catch {}
    json(res, { success: true });
  }));

  router.get('/players/whitelist-mode', asyncHandler(async (_req, res) => {
    json(res, getWhitelistMode());
  }));

  router.post('/players/whitelist-mode', blockWhileRunning, stopRequired, asyncHandler(async (req, res) => {
    const { enabled, sync } = req.body as { enabled?: boolean; sync?: boolean };
    if (typeof enabled !== 'boolean') return fail(res, 400, 'Missing enabled boolean', 'INVALID_BODY');

    writeProperties({ 'allow-list': enabled ? 'true' : 'false' } as Record<string, string>);

    let rosterSync: { added: number } | undefined;
    if (sync && enabled) {
      rosterSync = syncAllowlistRoster();
    }

    json(res, { success: true, enabled, rosterSync });
  }));

  router.get('/players/notes/:key', asyncHandler(async (req, res) => {
    const key = req.params.key as string;
    const note = getPlayerNote(key);
    json(res, note || { key, notes: '', updatedAt: '' });
  }));

  router.put('/players/notes/:key', asyncHandler(async (req, res) => {
    const key = req.params.key as string;
    const { notes } = req.body as { notes?: string };
    if (typeof notes !== 'string') return fail(res, 400, 'Missing notes string', 'INVALID_BODY');
    writePlayerNote(key, notes);
    json(res, { success: true });
  }));

  router.post('/players/allowlist/import', blockWhileRunning, stopRequired, asyncHandler(async (req, res) => {
    const { format, content, apply } = req.body as { format?: string; content?: string; apply?: boolean };
    if (!format || !content) return fail(res, 400, 'Missing format or content', 'INVALID_BODY');
    if (format !== 'csv' && format !== 'lines') return fail(res, 400, 'Format must be csv or lines', 'INVALID_FORMAT');

    if (apply) {
      applyBulkImport(content, format);
      json(res, { success: true });
    } else {
      json(res, previewBulkImport(content, format));
    }
  }));

  router.post('/players/permissions/apply-template', blockWhileRunning, stopRequired, asyncHandler(async (req, res) => {
    const { playerName, template } = req.body as { playerName?: string; template?: string };
    if (!playerName || !template) return fail(res, 400, 'Missing playerName or template', 'INVALID_BODY');
    if (!['member', 'moderator', 'admin'].includes(template)) {
      return fail(res, 400, 'Template must be member, moderator, or admin', 'INVALID_TEMPLATE');
    }
    try {
      applyPermissionTemplate(playerName, template as TemplateName);
      json(res, { success: true });
    } catch (e) {
      return fail(res, 400, (e as Error).message, 'TEMPLATE_FAILED');
    }
  }));

  router.get('/players/history', asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;
    json(res, getPlayerHistory(search, limit));
  }));

  router.post('/players/temp-bans/check-expiry', asyncHandler(async (_req, res) => {
    const server = ctx.getService('serverProcess') as unknown as ServerProcess;
    const expired = await processExpiredTempBans(server);
    json(res, { expired });
  }));

  return router;
}

export { createPlayersRouter };
