import test from 'node:test';
import assert from 'node:assert/strict';
import { healthResponseSchema } from '../src/schemas/health.schema.js';
test('health contract rejects contradictory state', () => {
  assert.equal(healthResponseSchema.safeParse({ ok: true, status: 'not_ready' }).success, false);
  assert.equal(healthResponseSchema.safeParse({ ok: false, status: 'alive' }).success, false);
});
