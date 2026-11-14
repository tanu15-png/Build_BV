import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { validPaymentSignature, requiresPayment } from '../src/services/payments.js';
import { loadConfig } from '../src/config/env.js';

test('Razorpay signatures require exact raw bytes, a full SHA256 signature and the correct secret', () => {
  const body = Buffer.from('{ "event": "payment.captured" }');
  const secret = 'test-webhook-secret-'.repeat(3);
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  assert(validPaymentSignature(body, signature, secret));
  assert(!validPaymentSignature(JSON.stringify(JSON.parse(body.toString())), signature, secret));
  for (const value of [undefined, 'x', '0'.repeat(64), signature.toUpperCase()]) assert(!validPaymentSignature(body, value, secret));
  assert(!validPaymentSignature(body, signature, 'wrong-secret'));
});
test('test checkout refuses live credentials or incomplete configuration', () => {
  const base = { DATABASE_URL: 'postgresql://local/test', FRONTEND_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 's'.repeat(32), OTP_SECRET: 'o'.repeat(32) };
  assert.throws(() => loadConfig({ ...base, ORDER_MODE: 'RAZORPAY_TEST' }));
  assert.throws(() => loadConfig({ ...base, RAZORPAY_KEY_ID: 'rzp_live_not_allowed' }));
  assert.equal(loadConfig(base).ORDER_MODE, 'TEST');
  assert(requiresPayment({ executionMode: 'RAZORPAY_TEST', paymentStatus: 'AWAITING_ACCEPTANCE' }));
  assert(!requiresPayment({ executionMode: 'RAZORPAY_TEST', paymentStatus: 'PAID' }));
  assert(!requiresPayment({ executionMode: 'REWARD', paymentStatus: 'NOT_REQUIRED_TEST' }));
});
