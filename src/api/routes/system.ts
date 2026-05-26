import express from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { json } from '../http';
import { MetricsService } from '../../metrics-service';
import type { AppContext } from '../../app-context';

function createSystemRouter(ctx: AppContext): express.Router {
  const router = express.Router();
  const metricsService = new MetricsService();

  router.get(
    '/system/metrics',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      const snapshot = await metricsService.getSnapshot(server, null);
      json(res, snapshot);
    }),
  );

  router.get('/system/metrics/stream', (req: express.Request, res: express.Response) => {
    const server = ctx.getService('serverProcess');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    const sendSnapshot = async () => {
      try {
        const snapshot = await metricsService.getSnapshot(server, null);
        res.write(`event: metrics\ndata: ${JSON.stringify(snapshot)}\n\n`);
      } catch {
        // Ignore write errors on closed connections
      }
    };

    // Send current snapshot immediately
    sendSnapshot();

    const interval = setInterval(sendSnapshot, 2000);

    req.on('close', () => {
      clearInterval(interval);
    });
  });

  return router;
}

export { createSystemRouter };
