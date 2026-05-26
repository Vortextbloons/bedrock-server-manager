import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ok, fail } from '../src/api/http';

interface MockResponse {
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  statusCode: number;
  body: unknown;
}

function mockRes(): MockResponse {
  let statusCode = 200;
  let body: unknown = null;
  return {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
    get statusCode() { return statusCode; },
    get body() { return body; },
  };
}

describe('http helpers', () => {
  it('ok wraps data in success envelope', () => {
    const res = mockRes();
    ok(res, { foo: 'bar' });
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data, { foo: 'bar' });
  });

  it('fail sets status and legacy error string', () => {
    const res = mockRes();
    fail(res, 409, 'busy', 'OPERATION_ACTIVE');
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, 'busy');
    assert.equal(res.body.errorDetail.code, 'OPERATION_ACTIVE');
  });
});
