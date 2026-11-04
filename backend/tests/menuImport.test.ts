import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { parseMenuSource, importMenuSource } from '../src/services/menuImport.js';

test('menu transcription validates positive exact prices, source pages, categories and duplicate names', () => {
  const [item] = parseMenuSource('# source\n@2|Snacks\nTea|12.50|Milk tea', 3);
  assert.equal(item!.pricePaise, 1250); assert.equal(item!.page, 2); assert.equal(item!.category, 'Snacks');
  for (const value of ['@4|Snacks\nTea|10', '@2|Snacks\nTea|0', '@2|Snacks\nTea|unknown', '@2|Snacks\nTea|10.001', 'Tea|10', '@2|Snacks\nTea|10\nTEA|15']) assert.throws(() => parseMenuSource(value, 3));
  const metadata = JSON.parse(readFileSync('data/menus/sources.json', 'utf8'));
  for (const [slug, info] of Object.entries(metadata) as [string, { pages: number }][]) assert(parseMenuSource(readFileSync(`data/menus/${slug}.menu.txt`, 'utf8'), info.pages).length > 100);
});

test('import previews do not write; imports preserve unrelated items and availability; replay never undoes staff edits', async () => {
  const categories = [{ id: 'drinks', name: 'drinks', archived: false }];
  const items = [
    { id: 'tea', name: 'Tea', categoryId: 'drinks', pricePaise: 1000, description: null, archived: false, available: false, version: 3 },
    { id: 'coffee', name: 'Manual Coffee', categoryId: 'drinks', pricePaise: 9000, description: null, archived: false, available: true, version: 1 },
    { id: 'sample', name: 'Sample Tea', categoryId: 'drinks', pricePaise: 1500, description: null, archived: false, available: true, version: 1 },
  ];
  let audit: unknown = null; let writes = 0;
  const tx = {
    $queryRaw: async () => [],
    canteen: { findUniqueOrThrow: async () => ({ id: 'canteen', slug: 'test' }), update: async () => { writes++; } },
    auditLog: { findFirst: async () => audit, create: async (value: unknown) => { writes++; audit = value; } },
    menuCategory: {
      findMany: async () => categories,
      createMany: async ({ data }: { data: { name: string }[] }) => { writes++; categories.push(...data.map((row, i) => ({ ...row, id: `category-${i}`, archived: false }))); },
      updateMany: async () => { writes++; }, update: async () => { writes++; },
    },
    menuItem: {
      findMany: async () => items,
      update: async ({ where, data }: { where: { id: string }; data: { name: string; categoryId: string; pricePaise: number; description: string | null; archived: boolean } }) => { writes++; Object.assign(items.find(item => item.id === where.id)!, { ...data, version: 4 }); },
      createMany: async ({ data }: { data: typeof items }) => { writes++; items.push(...data); },
      updateMany: async ({ where }: { where: { id: { in: string[] } } }) => { writes++; for (const item of items) if (where.id.in.includes(item.id)) { item.archived = true; item.available = false; } },
      count: async ({ where }: { where: { categoryId: string } }) => items.filter(item => item.categoryId === where.categoryId && !item.archived).length,
    },
  };
  const db = { $transaction: async (run: (db: unknown) => unknown) => run(tx) } as unknown as PrismaClient;
  const source = { slug: 'test', file: 'test.pdf', sha256: 'source-hash', items: parseMenuSource('@1|Drinks\nTea|20\n@1|Snacks\nSandwich|50', 1) };
  const preview = await importMenuSource(db, source, false); assert.equal(writes, 0); assert.equal(preview.created, 1); assert.equal(preview.updated, 1);
  const imported = await importMenuSource(db, source, true); assert.equal(imported.created, 1); assert.equal(imported.archivedSamples, 1);
  assert.equal(categories.length, 2, 'Existing lowercase category is reused instead of duplicated');
  assert.equal(items[0]!.pricePaise, 2000); assert.equal(items[0]!.available, false); assert.equal(items[1]!.pricePaise, 9000); assert.equal(items[2]!.archived, true);
  items[0]!.pricePaise = 2500; const before = writes;
  assert.equal((await importMenuSource(db, source, true)).skipped, true); assert.equal(writes, before); assert.equal(items[0]!.pricePaise, 2500);
});
