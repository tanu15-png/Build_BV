import { createHash, randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '../generated/prisma/client.js';
export type SourceItem = { category: string; name: string; pricePaise: number; description: string | null; page: number };
export const menuKey = (name: string) => name.normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function parseMenuSource(text: string, pageCount: number): SourceItem[] {
  const items: SourceItem[] = []; let category = ''; let page = 0;
  const names = new Set<string>();
  for (const [lineIndex, raw] of text.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    const line = raw.trim(); if (!line || line.startsWith('#')) continue;
    if (line.startsWith('@')) {
      const parts = line.slice(1).split('|'); page = Number(parts[0]); category = parts[1]?.trim() || '';
      if (parts.length !== 2 || !Number.isInteger(page) || page < 1 || page > pageCount || !category || category.length > 80) throw new Error(`Invalid category/page on line ${lineIndex + 1}`);
      continue;
    }
    const parts = line.split('|'); const name = parts[0]?.trim() || ''; const price = parts[1]?.trim() || '';
    if (!category || parts.length < 2 || parts.length > 3 || !name || name.length > 120 || !/^\d+(?:\.\d{1,2})?$/.test(price)) throw new Error(`Invalid item on line ${lineIndex + 1}`);
    const pricePaise = Math.round(Number(price) * 100);
    if (!Number.isSafeInteger(pricePaise) || pricePaise <= 0 || pricePaise > 10000000) throw new Error(`Invalid price on line ${lineIndex + 1}`);
    const key = menuKey(name); if (names.has(key)) throw new Error(`Duplicate item: ${name}`); names.add(key);
    items.push({ category, name, pricePaise, description: parts[2]?.trim() || null, page });
  }
  if (!items.length) throw new Error('The menu source has no priced items.');
  return items;
}
export type MenuSource = { slug: string; file: string; sha256: string; items: SourceItem[] };
export const menuFingerprint = (source: MenuSource) => createHash('sha256').update(JSON.stringify(source)).digest('hex');
export async function importMenuSource(db: PrismaClient, source: MenuSource, apply: boolean) {
  return db.$transaction(async tx => {
    const canteen = await tx.canteen.findUniqueOrThrow({ where: { slug: source.slug } });
    await tx.$queryRaw`SELECT id FROM canteens WHERE id = ${canteen.id}::uuid FOR UPDATE`;
    const manifestHash = menuFingerprint(source);
    const previous = await tx.auditLog.findFirst({ where: { action: 'MENU_PDF_IMPORTED', target: canteen.id, metadata: { path: ['manifestHash'], equals: manifestHash } } });
    const summary = { slug: source.slug, source: source.file, categories: new Set(source.items.map(item => item.category)).size, items: source.items.length, created: 0, updated: 0, archivedSamples: 0, skipped: Boolean(previous), applied: apply };
    // Re-running the same source must not undo later staff edits.
    if (previous) return summary;
    const categories = await tx.menuCategory.findMany({ where: { canteenId: canteen.id } });
    const existingItems = await tx.menuItem.findMany({ where: { canteenId: canteen.id } });
    const importedCategoryNames = [...new Set(source.items.map(item => item.category))];
    const categoryIds = new Map(categories.map(category => [menuKey(category.name), category.id]));
    if (apply) {
      await tx.menuCategory.createMany({ data: importedCategoryNames.filter(name => !categoryIds.has(menuKey(name))).map(name => ({ name, canteenId: canteen.id })), skipDuplicates: true });
      for (const category of await tx.menuCategory.findMany({ where: { canteenId: canteen.id } })) categoryIds.set(menuKey(category.name), category.id);
      await tx.menuCategory.updateMany({ where: { canteenId: canteen.id, id: { in: importedCategoryNames.map(name => categoryIds.get(menuKey(name))!) }, archived: true }, data: { archived: false, version: { increment: 1 } } });
    }
    const newItems: Prisma.MenuItemCreateManyInput[] = [];
    const matched = new Set<string>();
    for (const item of source.items) {
      const candidates = existingItems.filter(existing => menuKey(existing.name) === menuKey(item.name));
      const matchingCategory = candidates.filter(existing => existing.categoryId === categoryIds.get(menuKey(item.category)));
      const selected = matchingCategory.length === 1 ? matchingCategory[0] : candidates.length === 1 ? candidates[0] : undefined;
      if (!selected && candidates.length) throw new Error(`Ambiguous existing item in ${source.slug}: ${item.name}`);
      if (!selected) {
        summary.created++;
        if (apply) newItems.push({ canteenId: canteen.id, categoryId: categoryIds.get(menuKey(item.category))!, name: item.name, pricePaise: item.pricePaise, description: item.description, available: true, archived: false });
      } else {
        matched.add(selected.id);
        const changed = selected.name !== item.name || selected.categoryId !== categoryIds.get(menuKey(item.category)) || selected.pricePaise !== item.pricePaise || selected.description !== item.description || selected.archived;
        if (changed) {
          summary.updated++;
          if (apply) await tx.menuItem.update({ where: { id: selected.id }, data: { name: item.name, categoryId: categoryIds.get(menuKey(item.category))!, pricePaise: item.pricePaise, description: item.description, archived: false, version: { increment: 1 } } });
        }
      }
    }
    const samples = existingItems.filter(item => !matched.has(item.id) && !item.archived && /^sample\s/i.test(item.name));
    summary.archivedSamples = samples.length;
    if (apply) {
      if (newItems.length) await tx.menuItem.createMany({ data: newItems });
      if (samples.length) await tx.menuItem.updateMany({ where: { id: { in: samples.map(item => item.id) } }, data: { archived: true, available: false, version: { increment: 1 } } });
      for (const category of categories) if (!importedCategoryNames.includes(category.name) && ['Snacks', 'Drinks'].includes(category.name) && !await tx.menuItem.count({ where: { categoryId: category.id, archived: false } })) await tx.menuCategory.update({ where: { id: category.id }, data: { archived: true, version: { increment: 1 } } });
      await tx.canteen.update({ where: { id: canteen.id }, data: { version: { increment: 1 } } });
      await tx.auditLog.create({ data: { action: 'MENU_PDF_IMPORTED', target: canteen.id, requestId: randomUUID(), metadata: { ...summary, manifestHash, sourceSha256: source.sha256 } } });
    }
    return summary;
  }, { maxWait: 10000, timeout: 120000 });
}
