import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import references from '../src/data/menuImageReferences.json' with { type: 'json' };
import { menuPhoto } from '../src/services/menuPhotos.js';
import { canteenActiveOrderFirst } from '../src/utils/orderRules.js';

test('paid orders outrank newer incoming requests and payment timers; each group stays newest first', () => {
  const order = (id, day, extra) => ({ id, createdAt: `2026-11-${day}T10:00:00Z`, status: 'ACCEPTED', executionMode: 'RAZORPAY_TEST', paymentStatus: 'AWAITING_PAYMENT', ...extra });
  const rows = [order('timer-new', 15), order('paid-old', 12, { paymentStatus: 'PAID' }), order('incoming', 14, { status: 'RECEIVED' }), order('paid-new', 14, { paymentStatus: 'PAID' }), order('timer-old', 13)];
  assert.deepEqual(rows.sort(canteenActiveOrderFirst).map(x => x.id), ['paid-new', 'paid-old', 'incoming', 'timer-new', 'timer-old']);
});
test('all reviewed menu references have real, bounded WebP files; owner uploads and later URL edits take precedence', () => {
  assert.equal(Object.keys(references).length, 267);
  for (const [name, ref] of Object.entries(references)) {
    const file = new URL('../public' + ref.image, import.meta.url);
    assert(statSync(file).size < 250000, name);
    assert.equal(readFileSync(file).toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(menuPhoto({ name, imageRef: ref.replacesImageRef }).image, ref.image);
    assert.equal(menuPhoto({ name, imageRef: '/banners/images/new-photo' }).image, '/api/v1/student/banners/images/new-photo');
  }
  assert.equal(menuPhoto({ name: 'Aloo Patties', imageRef: 'https://owner.example/new-photo.jpg' }).image, 'https://owner.example/new-photo.jpg');
  assert.equal(menuPhoto({ name: 'New dish' }).image, '/food-placeholder.svg');
});
