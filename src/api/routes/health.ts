import express from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { json } from '../http';
import { getLanIPv4Addresses, readMinecraftPort } from '../../network';
import type { AppContext } from '../../app-context';

function createHealthRouter(ctx: AppContext): express.Router {
  const router = express.Router();

  router.get('/status', (_req: express.Request, res: express.Response) => {
    const server = ctx.getService('serverProcess');
    const pipeline = ctx.getService('updatePipeline');
    const status = server.getStatus();
    status.operationActive = pipeline.active;
    json(res, status);
  });

  router.get('/validate', (_req: express.Request, res: express.Response) => {
    json(res, ctx.validateServerCore());
  });

  router.get(
    '/info',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const { port } = ctx.getConfig();
      const { serverCore } = ctx.getPaths();
      const lanHosts = getLanIPv4Addresses();
      const minecraftPort = readMinecraftPort(serverCore);

      json(res, {
        port,
        serverCore,
        lanHosts,
        dashboardUrls: [
          `http://localhost:${port}`,
          ...lanHosts.map((host: string) => `http://${host}:${port}`),
        ],
        minecraftPort,
        minecraftAddresses: lanHosts.map((host: string) => `${host}:${minecraftPort}`),
      });
    }),
  );

  return router;
}

export { createHealthRouter };
