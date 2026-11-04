import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { loadConfig } from '../config/env.js';
import { createPrisma } from '../lib/prisma.js';
import { parseMenuSource, importMenuSource } from '../services/menuImport.js';
const sourceDir = pathToFileURL(resolve(__dirname, '../../data/menus') + '/');
async function main() {
  const config = loadConfig(); const db = createPrisma({ ...config, DB_TIMEOUT_MS: 10000 });
  try {
    const metadata = JSON.parse(await readFile(new URL('sources.json', sourceDir), 'utf8')) as Record<string, { file: string; pages: number; sha256: string }>;
    const sources = await Promise.all(Object.entries(metadata).map(async ([slug, info]) => ({ slug, file: info.file, sha256: info.sha256, items: parseMenuSource(await readFile(new URL(`${slug}.menu.txt`, sourceDir), 'utf8'), info.pages) })));
    const apply = process.argv.includes('--apply');
    if (apply) {
      const backup = await db.canteen.findMany({ where: { slug: { in: sources.map(source => source.slug) } }, include: { categories: true, menuItems: true } });
      const backupDir = pathToFileURL(resolve(__dirname, '../../.import-backups') + '/'); await mkdir(backupDir, { recursive: true });
      const target = new URL(`menus-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, backupDir);
      await writeFile(target, JSON.stringify(backup, null, 2), { flag: 'wx' });
      console.log(`Backup saved: ${fileURLToPath(target)}`);
    }
    const result = [];
    for (const source of sources) result.push(await importMenuSource(db, source, apply));
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'preview', canteens: result }, null, 2));
  } finally { await db.$disconnect(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Menu import failed.'); process.exitCode = 1; });
