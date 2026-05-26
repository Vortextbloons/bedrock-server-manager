import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, DEFAULT_CONFIG } from '../src/config/schema';

describe('config schema', () => {
  it('merges defaults for partial config', () => {
    const result = normalizeConfig({ port: 9000 });
    assert.equal(result.port, 9000);
    assert.equal(result.paths.serverCore, DEFAULT_CONFIG.paths.serverCore);
    assert.equal(result.server.executable, DEFAULT_CONFIG.server.executable);
  });

  it('rejects invalid port', () => {
    assert.throws(() => normalizeConfig({ port: 0 }), /port must be/);
  });

  it('requires paths.serverCore string', () => {
    assert.throws(() => normalizeConfig({ paths: { serverCore: '' } }), /paths\.serverCore/);
  });
});
