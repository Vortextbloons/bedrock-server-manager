import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { asyncHandler } from '../middleware/async-handler';
import { json, fail } from '../http';
import { requireIdle } from '../middleware/operation-lock';
import type { AppContext } from '../../app-context';

function createUpdateRouter(ctx: AppContext): express.Router {
  const router = express.Router();
  const pipeline = () => ctx.getService('updatePipeline');

  const storage = multer.diskStorage({
    destination: (_req: Express.Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
      cb(null, ctx.getPaths().updateDrop);
    },
    filename: (_req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      cb(null, file.originalname);
    },
  });

  const upload = multer({
    storage,
    fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      if (path.extname(file.originalname).toLowerCase() !== '.zip') {
        cb(new Error('Only .zip files are accepted'));
      } else {
        cb(null, true);
      }
    },
  });

  router.get(
    '/update/check',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const { updateDrop } = ctx.getPaths();
      if (!fs.existsSync(updateDrop)) {
        return json(res, { found: false, files: [], newest: null });
      }

      const files = fs.readdirSync(updateDrop)
        .filter((f: string) => f.endsWith('.zip'))
        .map((f: string) => {
          const filePath = path.join(updateDrop, f);
          const stat = fs.statSync(filePath);
          return { name: f, size: stat.size, date: stat.mtime.toISOString() };
        })
        .sort((a: { date: string }, b: { date: string }) => new Date(b.date).getTime() - new Date(a.date).getTime());

      json(res, {
        found: files.length > 0,
        files,
        newest: files.length > 0 ? files[0] : null,
      });
    }),
  );

  router.post('/update/upload', upload.single('zip'), (req: express.Request, res: express.Response) => {
    if (!req.file) {
      return fail(res, 400, 'No zip file uploaded', 'MISSING_FILE');
    }
    json(res, {
      success: true,
      filename: req.file.originalname,
      size: req.file.size,
    });
  });

  router.post(
    '/update/execute',
    requireIdle(ctx, ['update']),
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const { filename } = req.body || {};
      const { updateDrop } = ctx.getPaths();

      let zipPath: string;
      if (filename) {
        zipPath = path.join(updateDrop, path.basename(filename as string));
      } else {
        const files = fs.readdirSync(updateDrop)
          .filter((f: string) => f.endsWith('.zip'))
          .sort((a: string, b: string) => {
            const statA = fs.statSync(path.join(updateDrop, a));
            const statB = fs.statSync(path.join(updateDrop, b));
            return statB.mtimeMs - statA.mtimeMs;
          });

        if (files.length === 0) {
          return fail(res, 400, 'No zip file found in update-drop folder', 'NO_ZIP');
        }
        zipPath = path.join(updateDrop, files[0]);
      }

      if (!fs.existsSync(zipPath)) {
        return fail(res, 400, `Update zip not found: ${zipPath}`, 'ZIP_NOT_FOUND');
      }

      const encodedPath = Buffer.from(zipPath).toString('base64');
      json(res, { eventStream: `/api/update/events?path=${encodeURIComponent(encodedPath)}` });
    }),
  );

  router.get('/update/events', (req: express.Request, res: express.Response) => {
    const activePipeline = pipeline();
    const encodedPath = req.query.path as string | undefined;

    if (!encodedPath) {
      return fail(res, 400, 'Missing path parameter', 'MISSING_PATH');
    }

    const zipPath = Buffer.from(decodeURIComponent(encodedPath), 'base64').toString('utf-8');

    if (!fs.existsSync(zipPath)) {
      return fail(res, 400, `Update zip not found: ${zipPath}`, 'ZIP_NOT_FOUND');
    }

    if (activePipeline.active) {
      return fail(res, 409, 'An update is already in progress', 'OPERATION_ACTIVE');
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });

    const onStep = (data: unknown) => {
      res.write(`event: step\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const onComplete = (data: unknown) => {
      res.write(`event: complete\ndata: ${JSON.stringify(data)}\n\n`);
      cleanup();
    };

    const onError = (data: unknown) => {
      res.write(`event: error\ndata: ${JSON.stringify(data)}\n\n`);
      cleanup();
    };

    const cleanup = () => {
      activePipeline.removeListener('step', onStep);
      activePipeline.removeListener('complete', onComplete);
      activePipeline.removeListener('error', onError);
      setTimeout(() => {
        try { res.end(); } catch (e) { /* ignore */ }
      }, 1000);
    };

    activePipeline.on('step', onStep);
    activePipeline.once('complete', onComplete);
    activePipeline.once('error', onError);

    req.on('close', () => {
      activePipeline.removeListener('step', onStep);
      activePipeline.removeListener('complete', onComplete);
      activePipeline.removeListener('error', onError);
    });

    activePipeline.execute(zipPath).catch(() => { /* error already emitted */ });
  });

  return router;
}

export { createUpdateRouter };
