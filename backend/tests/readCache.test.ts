import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadCache } from '../src/services/readCache.js';

test('server cache deduplicates reads and invalidated in-flight results cannot restore old data', async () => {
  const cache=createReadCache();
  let resolve!: (value:string)=>void;
  const first=cache.get('catalog',()=>new Promise<string>(done=>{resolve=done;}));
  await Promise.resolve();
  const duplicate=cache.get('catalog',async()=> 'must not run');
  cache.clear();
  assert.equal(await cache.get('catalog',async()=> 'new'),'new');
  resolve('old');
  assert.equal(await first,'old'); assert.equal(await duplicate,'old');
  assert.equal(await cache.get('catalog',async()=> 'must not run'),'new');
  assert.equal(await cache.get('rewards:student-a',async()=>10),10);
  assert.equal(await cache.get('rewards:student-b',async()=>20),20);
});

test('token invalidation preserves cached menus while clearing all private balances',async()=>{
  const cache=createReadCache();
  await cache.get('catalog',async()=> 'menu');
  await cache.get('rewards:student-a',async()=>10);
  await cache.get('rewards:student-b',async()=>20);
  cache.clear('rewards:');
  assert.equal(await cache.get('catalog',async()=> 'wrong'),'menu');
  assert.equal(await cache.get('rewards:student-a',async()=>11),11);
  assert.equal(await cache.get('rewards:student-b',async()=>21),21);
});
