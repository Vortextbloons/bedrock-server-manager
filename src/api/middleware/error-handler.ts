import type { Request, Response, NextFunction } from 'express';
import { fail } from '../http';

function multerLikeError(err: Error): boolean {
  return (err as unknown as Record<string, unknown>).name === 'MulterError';
}

function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) {
    return;
  }

  if (multerLikeError(err)) {
    return fail(res, 400, `Upload error: ${err.message}`, 'UPLOAD_ERROR');
  }

  if (
    err.message === 'Only .zip files are accepted' ||
    err.message === 'Only .mcpack or .zip files are accepted' ||
    err.message === 'Only .mcpack, .zip, or .mcaddon files are accepted'
  ) {
    return fail(res, 400, err.message, 'INVALID_FILE_TYPE');
  }

  const status = (err as unknown as Record<string, unknown>).status || (err as unknown as Record<string, unknown>).statusCode || 500;
  fail(res, status as number, err.message || 'Internal server error', (err as unknown as Record<string, unknown>).code as string || 'INTERNAL_ERROR');
}

export { errorHandler };
