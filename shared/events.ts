import type { StateChangePayload } from './server';
import type { PipelineStepEvent, PipelineCompleteEvent, PipelineErrorEvent } from './pipeline';

export interface ServerLogEvent {
  data: string;
}

export interface ServerExitEvent {
  code: number | null;
}

export interface BackupsRefreshEvent {}

export type PipelineEvent = PipelineStepEvent | PipelineCompleteEvent | PipelineErrorEvent;

export interface BackendEventMap {
  'server.log': ServerLogEvent;
  'server.state': StateChangePayload;
  'server.exit': ServerExitEvent;
  'pipeline.step': PipelineStepEvent;
  'pipeline.complete': PipelineCompleteEvent;
  'pipeline.error': PipelineErrorEvent;
}
