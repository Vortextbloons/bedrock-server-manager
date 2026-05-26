import express from 'express';
import { errorHandler } from './middleware/error-handler';
import { createHealthRouter } from './routes/health';
import { createServerRouter } from './routes/server';
import { createUpdateRouter } from './routes/update';
import { createBackupsRouter } from './routes/backups';
import { createLogsRouter } from './routes/logs';
import { createConfigRouter } from './routes/config';
import { createPropertiesRouter } from './routes/properties';
import { createPlayersRouter } from './routes/players';
import { createPacksRouter } from './routes/packs';
import { createWorldsRouter } from './routes/worlds';
import { createSystemRouter } from './routes/system';
import type { AppContext } from '../app-context';

function createApiRouter(ctx: AppContext): express.Router {
  const router = express.Router();

  router.use(createHealthRouter(ctx));
  router.use(createServerRouter(ctx));
  router.use(createLogsRouter(ctx));
  router.use(createUpdateRouter(ctx));
  router.use(createBackupsRouter(ctx));
  router.use(createConfigRouter(ctx));
  router.use(createPropertiesRouter(ctx));
  router.use(createPlayersRouter(ctx));
  router.use(createPacksRouter(ctx));
  router.use(createWorldsRouter(ctx));
  router.use(createSystemRouter(ctx));

  router.use(errorHandler);

  return router;
}

export { createApiRouter };
