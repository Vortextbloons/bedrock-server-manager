import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OperationRegistry } from '../src/core/operation-registry';
import { requireIdle } from '../src/api/middleware/operation-lock';
import type { AppContext } from '../src/app-context';

interface MockResponse {
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  statusCode: number;
  body: unknown;
  ended: boolean;
}

function mockCtx(registry: OperationRegistry): AppContext {
  return { operations: registry } as AppContext;
}

function mockRes(): MockResponse {
  let statusCode = 200;
  let body: unknown = null;
  let ended = false;
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      ended = true;
      return this;
    },
    get statusCode() { return statusCode; },
    get body() { return body; },
    get ended() { return ended; },
  };
}

describe('operation lock', () => {
  it('blocks when registered operation is active', () => {
    const registry = new OperationRegistry();
    registry.register('update', () => true);
    const ctx = mockCtx(registry);
    const middleware = requireIdle(ctx, ['update']);
    const res = mockRes();
    let nextCalled = false;

    middleware({}, res, () => { nextCalled = true; });

    assert.equal(res.statusCode, 409);
    assert.match(res.body.error, /update/i);
    assert.equal(nextCalled, false);
  });

  it('calls next when idle', () => {
    const registry = new OperationRegistry();
    registry.register('update', () => false);
    const ctx = mockCtx(registry);
    const middleware = requireIdle(ctx, ['update']);
    const res = mockRes();
    let nextCalled = false;

    middleware({}, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(res.ended, false);
  });
});
