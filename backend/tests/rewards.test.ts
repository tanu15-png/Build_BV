import test from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { tokenSummary } from '../src/routes/rewards.routes.js';

test('tokens round per collected order, exclude pending/rejected orders and never earn on rewards', async () => {
  const rows = [
    { totalPaise: 1999, status: 'COLLECTED', executionMode: 'TEST' },
    { totalPaise: 1999, status: 'COLLECTED', executionMode: 'TEST' },
    { totalPaise: 100000, status: 'READY', executionMode: 'TEST' },
    { totalPaise: 100000, status: 'REJECTED', executionMode: 'TEST' },
    { totalPaise: 100000, status: 'COLLECTED', executionMode: 'REWARD' },
  ];
  const db = { order: { findMany: async (query: unknown) => {
    assert.deepEqual((query as {where:unknown}).where, { studentId: 'student', canteen: { slug: 'canteen' } });
    return rows;
  } } } as unknown as PrismaClient;
  const result = await tokenSummary(db, 'student');
  assert.equal(result.earned, 2);
  assert.equal(result.spent, 100);
});

test('a rejected reward restores its reserved tokens; pending reward orders reserve immediately', async () => {
  const rows = [
    { totalPaise: 150000, status: 'COLLECTED', executionMode: 'TEST' },
    { totalPaise: 0, status: 'REJECTED', executionMode: 'REWARD' },
    { totalPaise: 0, status: 'RECEIVED', executionMode: 'REWARD' },
  ];
  const db = { order: { findMany: async () => rows } } as unknown as PrismaClient;
  assert.deepEqual(await tokenSummary(db, 'student'), { earned: 150, spent: 100, balance: 50 });
  rows[2]!.status = 'REJECTED';
  assert.equal((await tokenSummary(db, 'student')).balance, 150);
});

test('mixed reward prices use the original order snapshots and restore only rejected deductions', async () => {
  const rows = [
    { totalPaise: 200000, status: 'COLLECTED', executionMode: 'TEST', rewardTokenCost: null },
    { totalPaise: 0, status: 'COLLECTED', executionMode: 'REWARD', rewardTokenCost: 30 },
    { totalPaise: 0, status: 'RECEIVED', executionMode: 'REWARD', rewardTokenCost: 65 },
    { totalPaise: 0, status: 'REJECTED', executionMode: 'REWARD', rewardTokenCost: 120 },
  ];
  const db = { order: { findMany: async () => rows } } as unknown as PrismaClient;
  assert.deepEqual(await tokenSummary(db, 'student'), { earned: 200, spent: 95, balance: 105 });
  rows[2]!.status = 'REJECTED';
  assert.deepEqual(await tokenSummary(db, 'student'), { earned: 200, spent: 30, balance: 170 });
});
