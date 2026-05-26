import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import { asyncHandler } from '../middleware/async-handler';
import { json, fail } from '../http';
import { requireIdle, requireServerStopped } from '../middleware/operation-lock';
import { zipWorldFolder, addDirectoryToZip } from '../../backup-service';
import {
  listWorlds,
  activateWorld,
  renameWorld,
  readLevelDat,
  resolveDimensionPath,
} from '../../world-service';

function parseBoolQuery(value: unknown): boolean {
  if (value === true || value === 'true' || value === '1') return true;
  return false;
}
import type { AppContext } from '../../app-context';

function createWorldsRouter(ctx: AppContext): express.Router {
  const router = express.Router();
  const blockWhileRunning = requireIdle(ctx, ['update', 'restore']);
  const stopRequired = requireServerStopped(ctx);

  const worldUpload = multer({
    storage: multer.diskStorage({
      destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        cb(null, ctx.getPaths().managerData);
      },
      filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
        cb(null, `world-import-${Date.now()}-${file.originalname}`);
      },
    }),
    limits: { fileSize: 512 * 1024 * 1024 },
  });

  router.get(
    '/worlds',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      json(res, listWorlds());
    }),
  );

  router.post(
    '/worlds/activate',
    blockWhileRunning,
    stopRequired,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const { name } = req.body as { name?: string };
      if (!name) return fail(res, 400, 'Missing world name', 'INVALID_BODY');
      try {
        activateWorld(name);
        json(res, { success: true, activeWorld: name });
      } catch (e) {
        return fail(res, 404, (e as Error).message, 'WORLD_NOT_FOUND');
      }
    }),
  );

  router.post(
    '/worlds/rename',
    blockWhileRunning,
    stopRequired,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const { from, to } = req.body as { from?: string; to?: string };
      if (!from || !to) return fail(res, 400, 'Missing from/to name', 'INVALID_BODY');
      if (!/^[\w\s-]+$/.test(to)) return fail(res, 400, 'Invalid world name', 'INVALID_NAME');
      try {
        renameWorld(from, to);
        json(res, { success: true });
      } catch (e) {
        return fail(res, 400, (e as Error).message, 'RENAME_FAILED');
      }
    }),
  );

  router.delete(
    '/worlds/:name',
    blockWhileRunning,
    stopRequired,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const name = req.params.name as string;
      const { confirmName, backup } = req.body as { confirmName?: string; backup?: boolean };

      if (confirmName !== name) {
        return fail(res, 400, 'World name confirmation does not match', 'CONFIRM_MISMATCH');
      }

      const { serverCore, backups: backupsDir } = ctx.getPaths();
      const worldPath = path.join(serverCore, 'worlds', name);
      if (!fs.existsSync(worldPath)) {
        return fail(res, 404, `World not found: ${name}`, 'WORLD_NOT_FOUND');
      }

      const worlds = listWorlds();
      if (worlds.activeWorld === name) {
        return fail(res, 409, 'Cannot delete the active world. Activate another world first.', 'ACTIVE_WORLD');
      }

      if (backup !== false) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupsDir, `world_${name}_${timestamp}.zip`);
        try {
          zipWorldFolder(name, backupPath);
        } catch (e) {
          return fail(res, 500, `Backup failed: ${(e as Error).message}`, 'BACKUP_FAILED');
        }
      }

      fs.rmSync(worldPath, { recursive: true, force: true });
      json(res, { success: true });
    }),
  );

  router.get(
    '/worlds/:name/export',
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const name = req.params.name as string;
      const { serverCore } = ctx.getPaths();
      const worldPath = path.join(serverCore, 'worlds', name);
      if (!fs.existsSync(worldPath)) {
        return fail(res, 404, `World not found: ${name}`, 'WORLD_NOT_FOUND');
      }

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="world_${name}.zip"`);

      const zip = new AdmZip();
      addDirectoryToZip(zip, worldPath, name);
      const tmpPath = path.join(ctx.getPaths().managerData, `world-export-${name}-${Date.now()}.zip`);
      zip.writeZip(tmpPath);
      const buffer = fs.readFileSync(tmpPath);
      try { fs.unlinkSync(tmpPath); } catch {}
      res.send(buffer);
    }),
  );

  router.post(
    '/worlds/import',
    blockWhileRunning,
    stopRequired,
    worldUpload.single('world'),
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const file = req.file;
      if (!file) {
        return fail(res, 400, 'No world zip file uploaded', 'MISSING_FILE');
      }

      const queryName = typeof req.query.name === 'string' ? req.query.name : undefined;
      const bodyName = typeof req.body?.name === 'string' ? req.body.name : undefined;
      const name = queryName || bodyName;
      const overwrite = parseBoolQuery(req.query.overwrite) || parseBoolQuery(req.body?.overwrite);
      const backup = req.query.backup !== undefined
        ? parseBoolQuery(req.query.backup)
        : req.body?.backup !== undefined
          ? parseBoolQuery(req.body.backup)
          : true;

      const worldName = name || path.basename(file.originalname, '.zip');
      if (!/^[\w\s-]+$/.test(worldName)) {
        return fail(res, 400, 'Invalid world name', 'INVALID_NAME');
      }

      const { serverCore, backups: backupsDir } = ctx.getPaths();
      const destDir = path.join(serverCore, 'worlds', worldName);

      if (fs.existsSync(destDir)) {
        if (!overwrite) {
          return fail(res, 409, `World "${worldName}" already exists. Use overwrite=true`, 'WORLD_EXISTS');
        }
        if (backup !== false) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = path.join(backupsDir, `world_${worldName}_preimport_${timestamp}.zip`);
          try {
            zipWorldFolder(worldName, backupPath);
          } catch (e) {
            return fail(res, 500, `Backup failed: ${(e as Error).message}`, 'BACKUP_FAILED');
          }
        }
        fs.rmSync(destDir, { recursive: true, force: true });
      }

      let zip: AdmZip;
      try {
        zip = new AdmZip(file.path);
      } catch {
        return fail(res, 400, 'Invalid zip file', 'INVALID_ZIP');
      }

      const entries = zip.getEntries();
      const hasLevelDat = entries.some((e: any) => e.entryName.includes('level.dat'));
      const hasDbFolder = entries.some((e: any) => e.entryName.startsWith('db/'));
      if (!hasLevelDat && !hasDbFolder) {
        return fail(res, 400, 'Zip does not contain a valid world (no level.dat or db/ found)', 'INVALID_WORLD');
      }

      zip.extractAllTo(destDir, true);

      try { fs.unlinkSync(file.path); } catch {
        // ignore cleanup errors
      }

      json(res, { success: true, name: worldName });
    }),
  );

  router.post(
    '/worlds/:name/reset-dimension',
    blockWhileRunning,
    stopRequired,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const name = req.params.name as string;
      const { dimension, backup } = req.body as { dimension?: string; backup?: boolean };

      if (dimension !== 'nether' && dimension !== 'end') {
        return fail(res, 400, 'Dimension must be "nether" or "end"', 'INVALID_DIMENSION');
      }

      const { serverCore, backups: backupsDir } = ctx.getPaths();
      const worldPath = path.join(serverCore, 'worlds', name);
      if (!fs.existsSync(worldPath)) {
        return fail(res, 404, `World not found: ${name}`, 'WORLD_NOT_FOUND');
      }

      const dimPath = resolveDimensionPath(worldPath, dimension);

      if (!dimPath) {
        return fail(res, 404, `${dimension} dimension folder not found in world`, 'DIM_NOT_FOUND');
      }

      const dimFolder = path.basename(dimPath);

      if (backup !== false) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupsDir, `${name}_${dimension}_${timestamp}.zip`);
        try {
          const z = new AdmZip();
          addDirectoryToZip(z, dimPath, dimFolder);
          z.writeZip(backupPath);
        } catch (e) {
          return fail(res, 500, `Backup failed: ${(e as Error).message}`, 'BACKUP_FAILED');
        }
      }

      fs.rmSync(dimPath, { recursive: true, force: true });
      json(res, { success: true, dimension });
    }),
  );

  router.get(
    '/worlds/:name/level',
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const name = req.params.name as string;
      const info = await readLevelDat(name);
      json(res, info);
    }),
  );

  return router;
}

export { createWorldsRouter };
