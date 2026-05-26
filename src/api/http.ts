import type { Response } from 'express';

function ok(res: Response, data: unknown): void {
  res.json({ success: true, data });
}

function fail(res: Response, status: number, message: string, code: string = 'ERROR'): void {
  res.status(status).json({
    success: false,
    error: message,
    errorDetail: { message, code },
  });
}

function json(res: Response, body: unknown): void {
  res.json(body);
}

export { ok, fail, json };
