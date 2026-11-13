import { loadConfig } from '../config/env.js';
import { createPrisma } from '../lib/prisma.js';
async function main() {
const db = createPrisma(loadConfig());
try {
  const rewards = await db.reward.findMany({ where: { canteen: { slug: 'canteen' }, active: true, menuItem: { archived: false, available: true, category: { archived: false } } }, include: { menuItem: true }, orderBy: [{ tokenCost: 'asc' }, { id: 'asc' }] });
  console.log(JSON.stringify({ rewardsQuery: 'ok', count: rewards.length }));
  await db.order.findMany({ where: { canteen: { slug: 'canteen' } }, select: { totalPaise: true, status: true, executionMode: true, rewardTokenCost: true }, take: 1 });
  console.log('Token query: ok');
} catch (error) {
  const issue = error as { name?: string; code?: string; meta?: unknown };
  console.log(JSON.stringify({ name: issue.name, code: issue.code, meta: issue.meta }));
  process.exitCode = 1;
} finally { await db.$disconnect(); }

}
void main();
