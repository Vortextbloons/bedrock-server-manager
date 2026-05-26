import express from 'express';
import { json } from '../http';
import type { AppContext } from '../../app-context';
import type { BackendEventMap } from '../../../shared/events';

function createLogsRouter(ctx: AppContext): express.Router {
  const router = express.Router();

  router.get('/server/logs', (req: express.Request, res: express.Response) => {
    const server = ctx.getService('serverProcess');
    const linesParam = req.query.lines;
    const lines = typeof linesParam === 'string' ? parseInt(linesParam, 10) : 200;
    const count = Number.isFinite(lines) ? Math.min(Math.max(lines, 1), 500) : 200;
    const raw = server.getLogs(count);
    const lineList = raw ? raw.split('\n').filter((l) => l.length > 0) : [];
    json(res, { lines: lineList });
  });

  router.get('/server/logs/stream', (req: express.Request, res: express.Response) => {
    const server = ctx.getService('serverProcess');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    const tail = server.getLogs(200);
    if (tail) {
      for (const line of tail.split('\n').filter((l) => l.length > 0)) {
        res.write(`event: log\ndata: ${JSON.stringify({ data: line })}\n\n`);
      }
    }

    const onLog = (payload: BackendEventMap['server.log']) => {
      const chunks = payload.data.split('\n').filter((l) => l.trim());
      for (const line of chunks) {
        res.write(`event: log\ndata: ${JSON.stringify({ data: line })}\n\n`);
      }
    };

    ctx.bus.onTyped('server.log', onLog);

    req.on('close', () => {
      ctx.bus.offTyped('server.log', onLog);
    });
  });

  return router;
}

export { createLogsRouter };
