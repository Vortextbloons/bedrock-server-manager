import express from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { json, fail } from '../http';
import { requireIdle } from '../middleware/operation-lock';
import type { AppContext } from '../../app-context';

function createBackupsRouter(ctx: AppContext): express.Router {
  const router = express.Router();
  const blockMutations = requireIdle(ctx, ['update', 'restore']);

  router.get(
    '/backups',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const backup = ctx.getService('backupService');
      json(res, { backups: backup.listBackups() });
    }),
  );

  router.post(
    '/backups/create',
    blockMutations,
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const backup = ctx.getService('backupService');
      const result = await backup.createBackup();
      json(res, { backup: result });
    }),
  );

  router.post(
    '/backups/restore',
    blockMutations,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const { name } = req.body as { name?: string };
      if (!name) {
        return fail(res, 400, 'Missing backup name', 'MISSING_NAME');
      }

      const server = ctx.getService('serverProcess');
      const backup = ctx.getService('backupService');

      if (server.getStatus().running) {
        await server.stop();
      }

      await backup.restoreBackup(name);
      json(res, { success: true, name });
    }),
  );

  router.delete(
    '/backups/:name',
    blockMutations,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const backup = ctx.getService('backupService');
      backup.deleteBackup(req.params.name as string);
      json(res, { success: true });
    }),
  );

  return router;
}

export { createBackupsRouter };
