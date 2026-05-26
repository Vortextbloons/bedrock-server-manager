import express from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { json } from '../http';
import * as configModule from '../../config';
import type { AppContext } from '../../app-context';
import type { ManagerConfig } from '../../../shared/config';

function createConfigRouter(_ctx: AppContext): express.Router {
  const router = express.Router();

  router.get(
    '/config',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const { config, resolvedPaths } = configModule.getConfigSnapshot();
      json(res, {
        config,
        resolvedPaths,
        validation: configModule.validateServerCore(),
      });
    }),
  );

  router.put(
    '/config',
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const body = req.body as ManagerConfig;
      const { requiresRestart } = configModule.save(body);
      const { config, resolvedPaths } = configModule.getConfigSnapshot();
      json(res, { requiresRestart, config, resolvedPaths });
    }),
  );

  return router;
}

export { createConfigRouter };
