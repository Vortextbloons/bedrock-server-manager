import express from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { json, fail } from '../http';
import { requireIdle } from '../middleware/operation-lock';
import { readProperties, writeProperties } from '../../properties-service';
import type { AppContext } from '../../app-context';
import type { PropertiesPutRequest } from '../../../shared/properties';

function createPropertiesRouter(ctx: AppContext): express.Router {
  const router = express.Router();
  const blockWhileRunning = requireIdle(ctx, ['update', 'restore']);

  router.get(
    '/properties',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      json(res, readProperties());
    }),
  );

  router.put(
    '/properties',
    blockWhileRunning,
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      if (server.getStatus().running) {
        return fail(res, 409, 'Stop the server before editing server.properties', 'SERVER_RUNNING');
      }

      const { updates } = req.body as PropertiesPutRequest;
      if (!updates || typeof updates !== 'object') {
        return fail(res, 400, 'Missing updates object', 'INVALID_BODY');
      }

      json(res, writeProperties(updates));
    }),
  );

  return router;
}

export { createPropertiesRouter };
