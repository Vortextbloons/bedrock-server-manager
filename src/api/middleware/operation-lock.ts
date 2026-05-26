import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { fail } from '../http';
import type { AppContext } from '../../app-context';

function requireIdle(ctx: AppContext, blockIds: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const activeId = ctx.operations.findActive(blockIds);
    if (activeId) {
      const message =
        activeId === 'update'
          ? 'An update is in progress'
          : activeId === 'restore'
            ? 'A backup restore is in progress'
            : `Operation "${activeId}" is in progress`;
      return fail(res, 409, message, 'OPERATION_ACTIVE');
    }
    next();
  };
}

function requireServerStopped(ctx: AppContext): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const server = ctx.getService('serverProcess');
    if (server.getStatus().running) {
      return fail(res, 409, 'Stop the server before making file changes', 'SERVER_RUNNING');
    }
    next();
  };
}

export { requireIdle, requireServerStopped };
