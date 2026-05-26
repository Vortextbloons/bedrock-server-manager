import * as config from './config';
import { getEventBus } from './core/event-bus';
import { OperationRegistry } from './core/operation-registry';
import { ServerProcess } from './server-process';
import { BackupService } from './backup-service';
import { ExtractService } from './extract-service';
import { UpdatePipeline } from './update-pipeline';
import type { BackendEventMap } from '../shared/events';
import type { ServiceMap, ServiceName } from '../shared/services';
import type { EventBus } from './core/event-bus';
import type { ManagerConfig, ResolvedPaths, ValidationResult } from '../shared/config';
import { wirePlayerHistory } from './player-history-bridge';
import { startTempBanExpiryScheduler } from './temp-ban-expiry';

export interface AppContext {
  getConfig: () => ManagerConfig;
  getPaths: () => ResolvedPaths;
  validateServerCore: () => ValidationResult;
  getService: <K extends ServiceName>(name: K) => ServiceMap[K];
  bus: EventBus<BackendEventMap>;
  operations: OperationRegistry;
  rootDir: string;
}

function bridgeServerEvents(bus: EventBus<BackendEventMap>, serverProcess: ServerProcess): void {
  serverProcess.on('log', (data: string) => {
    bus.emitTyped('server.log', { data });
  });
  serverProcess.on('stateChange', (payload: unknown) => {
    bus.emitTyped('server.state', payload as BackendEventMap['server.state']);
  });
  serverProcess.on('exit', (code: number | null) => {
    bus.emitTyped('server.exit', { code });
  });
}

function bridgePipelineEvents(bus: EventBus<BackendEventMap>, updatePipeline: UpdatePipeline): void {
  updatePipeline.on('step', (payload: unknown) => {
    bus.emitTyped('pipeline.step', payload as BackendEventMap['pipeline.step']);
  });
  updatePipeline.on('complete', (payload: unknown) => {
    bus.emitTyped('pipeline.complete', payload as BackendEventMap['pipeline.complete']);
  });
  updatePipeline.on('error', (payload: unknown) => {
    bus.emitTyped('pipeline.error', payload as BackendEventMap['pipeline.error']);
  });
}

function createAppContext(): AppContext {
  const loaded = config.load();
  const bus = getEventBus();
  const operations = new OperationRegistry();

  const serverProcess = new ServerProcess();
  const backupService = new BackupService();
  const extractService = new ExtractService();
  const updatePipeline = new UpdatePipeline({
    serverProcess,
    backupService,
    extractService,
  });

  operations.register('update', () => updatePipeline.active);
  operations.register('restore', () => backupService.active);

  bridgeServerEvents(bus, serverProcess);
  bridgePipelineEvents(bus, updatePipeline);
  wirePlayerHistory(bus);
  startTempBanExpiryScheduler(serverProcess);

  const services: ServiceMap = {
    serverProcess: serverProcess as any,
    backupService: backupService as any,
    extractService: extractService as any,
    updatePipeline: updatePipeline as any,
  };

  return {
    getConfig: config.getConfig,
    getPaths: config.getPaths,
    validateServerCore: config.validateServerCore,
    getService<K extends ServiceName>(name: K): ServiceMap[K] {
      if (!services[name]) {
        throw new Error(`Unknown service: ${name}`);
      }
      return services[name];
    },
    bus,
    operations,
    rootDir: loaded.rootDir,
  };
}

export { createAppContext };
