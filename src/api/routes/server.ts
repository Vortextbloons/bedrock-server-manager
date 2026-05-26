import express from 'express';
import { asyncHandler } from '../middleware/async-handler';
import { fail, json } from '../http';
import { requireIdle } from '../middleware/operation-lock';
import { ServerProcess } from '../../server-process';
import { getCommandService } from '../../command-service';
import { BEDROCK_GAMERULES } from '../../../shared/gamerules';
import { fetchGameruleValues, parseGameruleQueryOutput } from '../../gamerule-service';
import type { AppContext } from '../../app-context';
import type { GameruleValue, GamerulesResponse } from '../../../shared/gamerules';

function createServerRouter(ctx: AppContext): express.Router {
  const router = express.Router();
  const blockServerControl = requireIdle(ctx, ['update', 'restore']);

  router.post(
    '/server/start',
    blockServerControl,
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      await server.start();
      json(res, { success: true, message: 'Server started' });
    }),
  );

  router.post(
    '/server/stop',
    blockServerControl,
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      await server.stop();
      json(res, { success: true, message: 'Server stopped' });
    }),
  );

  router.post(
    '/server/command',
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      const { command } = req.body as { command?: string };
      if (!command || typeof command !== 'string') {
        return fail(res, 400, 'Missing command string', 'INVALID_BODY');
      }
      const output = await server.runCommand(command);
      json(res, { output });
    }),
  );

  // GAMERULES
  router.get(
    '/server/gamerules',
    asyncHandler(async (_req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      const isOnline = server.getStatus().running;

      const gamerules: GameruleValue[] = Object.entries(BEDROCK_GAMERULES).map(([rule, def]) => ({
        rule,
        currentValue: '',
        type: def.type,
        label: def.label,
        description: def.description,
        defaultValue: def.defaultValue,
      }));

      if (isOnline) {
        try {
          const serverProcess = server as unknown as ServerProcess;
          const values = await fetchGameruleValues(serverProcess);
          for (const g of gamerules) {
            if (values[g.rule] !== undefined) {
              g.currentValue = values[g.rule];
            }
          }
        } catch {
          // query failed, leave values empty
        }
      }

      json(res, { gamerules, isOnline } satisfies GamerulesResponse);
    }),
  );

  router.put(
    '/server/gamerules',
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      if (!server.getStatus().running) {
        return fail(res, 409, 'Server must be running to set gamerules', 'SERVER_NOT_RUNNING');
      }

      const { rule, value } = req.body as { rule?: string; value?: string | boolean | number };
      if (!rule) return fail(res, 400, 'Missing gamerule name', 'INVALID_BODY');
      if (value === undefined) return fail(res, 400, 'Missing gamerule value', 'INVALID_BODY');

      const serverProcess = server as unknown as ServerProcess;
      const cmdService = getCommandService(serverProcess);
      const result = await cmdService.gamerule(rule, value);
      const parsed = parseGameruleQueryOutput(result.output, rule);
      const currentValue =
        parsed ??
        (typeof value === 'boolean' ? String(value) : String(value));
      json(res, { ...result, currentValue });
    }),
  );

  // ONLINE PLAYER ACTIONS (tp, give, kill)
  router.post(
    '/server/actions',
    asyncHandler(async (req: express.Request, res: express.Response) => {
      const server = ctx.getService('serverProcess');
      if (!server.getStatus().running) {
        return fail(res, 409, 'Server must be running to perform actions', 'SERVER_NOT_RUNNING');
      }

      const { action, target, destination, x, y, z, item, amount, data } = req.body as {
        action?: string;
        target?: string;
        destination?: string;
        x?: number;
        y?: number;
        z?: number;
        item?: string;
        amount?: number;
        data?: number;
      };

      if (!action || !target) {
        return fail(res, 400, 'Missing action or target', 'INVALID_BODY');
      }

      const serverProcess = server as unknown as ServerProcess;
      const cmdService = getCommandService(serverProcess);

      const listOutput = await serverProcess.runCommand('list');
      const onlineNames = serverProcess.parseListCommand(listOutput).map((n) => n.toLowerCase());
      if (!onlineNames.includes(target.toLowerCase())) {
        return fail(res, 400, `Player "${target}" is not online`, 'PLAYER_OFFLINE');
      }

      try {
        let result;
        switch (action) {
          case 'tp':
            if (x !== undefined && y !== undefined && z !== undefined) {
              result = await cmdService.tp(target, undefined, { x, y, z });
            } else {
              if (!destination) {
                return fail(res, 400, 'Missing destination player for tp', 'INVALID_BODY');
              }
              if (!onlineNames.includes(destination.toLowerCase())) {
                return fail(res, 400, `Player "${destination}" is not online`, 'PLAYER_OFFLINE');
              }
              result = await cmdService.tp(target, destination);
            }
            break;
          case 'give':
            if (!item) return fail(res, 400, 'Missing item for give action', 'INVALID_BODY');
            result = await cmdService.give(target, item, amount, data);
            break;
          case 'kill':
            result = await cmdService.kill(target);
            break;
          default:
            return fail(res, 400, 'Invalid action. Use tp, give, or kill', 'INVALID_ACTION');
        }
        json(res, result);
      } catch (e) {
        return fail(res, 400, (e as Error).message, 'ACTION_FAILED');
      }
    }),
  );

  return router;
}

export { createServerRouter };
