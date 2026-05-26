import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../middleware/async-handler';
import { json, fail } from '../http';
import { requireIdle } from '../middleware/operation-lock';
import {
  scanInstalled,
  installPack,
  enablePack,
  disablePack,
  deletePack,
  scanConflicts,
  checkVersionWarnings,
  replacePack,
  readWorldPackJsonForWorld,
  getWorldPacks,
} from '../../pack-service';
import type { AppContext } from '../../app-context';
import type { PackEnableRequest, PackDisableRequest, PackType } from '../../../shared/packs';

function createPacksRouter(ctx: AppContext): express.Router {
  const router = express.Router();
  const blockWhileRunning = requireIdle(ctx, ['update', 'restore']);

  const storage = multer.diskStorage({
    destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
      cb(null, ctx.getPaths().packDrop);
    },
    filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      cb(null, file.originalname);
    },
  });

  const upload = multer({
    storage,
    fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (ext !== '.mcpack' && ext !== '.zip' && ext !== '.mcaddon') {
        cb(new Error('Only .mcpack, .zip, or .mcaddon files are accepted'));
      } else {
        cb(null, true);
      }
    },
  });

  router.get(
    '/packs',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const behavior = scanInstalled('behavior');
      const resource = scanInstalled('resource');
      json(res, { behavior, resource });
    }),
  );

  router.get(
    '/packs/drop',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const { packDrop } = ctx.getPaths();
      const result: {
        behavior: Array<{ name: string; size: number; date: string }>;
        resource: Array<{ name: string; size: number; date: string }>;
      } = { behavior: [], resource: [] };

      for (const type of ['behavior', 'resource'] as const) {
        const dir = path.join(packDrop, type);
        if (fs.existsSync(dir)) {
          result[type] = fs.readdirSync(dir)
            .filter((f) => {
              const ext = path.extname(f).toLowerCase();
              return ext === '.mcpack' || ext === '.zip' || ext === '.mcaddon';
            })
            .map((f) => {
              const filePath = path.join(dir, f);
              const stat = fs.statSync(filePath);
              return { name: f, size: stat.size, date: stat.mtime.toISOString() };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
      }

      json(res, result);
    }),
  );

  router.post(
    '/packs/install',
    blockWhileRunning,
    upload.single('pack'),
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      if (server.getStatus().running) {
        return fail(res, 409, 'Stop the server before installing packs', 'SERVER_RUNNING');
      }

      if (!req.file) {
        return fail(res, 400, 'No pack file uploaded', 'MISSING_FILE');
      }

      const entries = await installPack(req.file.path, req.file.originalname);

      // Clean up uploaded file after installation
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // ignore cleanup errors
      }

      json(res, { entries });
    }),
  );

  router.post(
    '/packs/enable',
    blockWhileRunning,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      if (server.getStatus().running) {
        return fail(res, 409, 'Stop the server before enabling packs', 'SERVER_RUNNING');
      }

      const { packId, type } = req.body as PackEnableRequest;
      if (!packId || !type || (type !== 'behavior' && type !== 'resource')) {
        return fail(res, 400, 'Missing or invalid packId/type', 'INVALID_BODY');
      }

      enablePack(packId, type);
      json(res, { success: true });
    }),
  );

  router.post(
    '/packs/disable',
    blockWhileRunning,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      if (server.getStatus().running) {
        return fail(res, 409, 'Stop the server before disabling packs', 'SERVER_RUNNING');
      }

      const { packId, type } = req.body as PackDisableRequest;
      if (!packId || !type || (type !== 'behavior' && type !== 'resource')) {
        return fail(res, 400, 'Missing or invalid packId/type', 'INVALID_BODY');
      }

      disablePack(packId, type);
      json(res, { success: true });
    }),
  );

  router.delete(
    '/packs/:type/:packId',
    blockWhileRunning,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      if (server.getStatus().running) {
        return fail(res, 409, 'Stop the server before deleting packs', 'SERVER_RUNNING');
      }

      const { type, packId } = req.params;
      if (!packId || (type !== 'behavior' && type !== 'resource')) {
        return fail(res, 400, 'Missing or invalid type/packId', 'INVALID_PARAMS');
      }

      deletePack(packId as string, type as 'behavior' | 'resource');
      json(res, { success: true });
    }),
  );

  router.get(
    '/packs/conflicts',
    asyncHandler(async (_req, res) => {
      json(res, scanConflicts());
    }),
  );

  router.get(
    '/packs/deps',
    asyncHandler(async (_req, res) => {
      json(res, checkVersionWarnings());
    }),
  );

  router.post(
    '/packs/replace',
    blockWhileRunning,
    asyncHandler(async (req, res) => {
      const server = ctx.getService('serverProcess');
      if (server.getStatus().running) {
        return fail(res, 409, 'Stop the server before replacing packs', 'SERVER_RUNNING');
      }

      const { packId, type } = req.body as { packId?: string; type?: string };
      if (!packId || !type || (type !== 'behavior' && type !== 'resource')) {
        return fail(res, 400, 'Missing or invalid packId/type', 'INVALID_BODY');
      }

      try {
        const next = replacePack(packId, type as PackType);
        if (!next) {
          return fail(res, 404, 'No replacement pack found in drop folder', 'NO_REPLACEMENT');
        }
        json(res, { next });
      } catch (e) {
        return fail(res, 400, (e as Error).message, 'REPLACE_FAILED');
      }
    }),
  );

  router.get(
    '/packs/worlds',
    asyncHandler(async (_req, res) => {
      json(res, { packs: getWorldPacks() });
    }),
  );

  router.get(
    '/packs/world/:worldName',
    asyncHandler(async (req, res) => {
      const worldName = req.params.worldName as string;
      const behavior = readWorldPackJsonForWorld(worldName, 'behavior');
      const resource = readWorldPackJsonForWorld(worldName, 'resource');
      json(res, { worldName, behavior, resource });
    }),
  );

  return router;
}

export { createPacksRouter };
