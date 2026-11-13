import test from 'node:test';
import assert from 'node:assert/strict';
import { createReadCache } from '../src/services/readCache.js';

test('cached reads deduplicate, expire and keep private account scopes separate', async () => {
  let time = 0, calls = 0;
  const cache = createReadCache({ now: () => time });
  const read = async () => ++calls;
  assert.deepEqual(await Promise.all([cache.get('user-a:tokens',read,100),cache.get('user-a:tokens',read,100)]),[1,1]);
  assert.equal(await cache.get('user-a:tokens',read,100),1);
  assert.equal(await cache.get('user-b:tokens',read,100),2);
  time=101;
  assert.equal(await cache.get('user-a:tokens',read,100),3);
  cache.invalidate();
  assert.equal(cache.peek('user-a:tokens'),undefined);
});

test('invalidation prevents an older request overwriting a post-write read; failures retry', async () => {
  const cache=createReadCache();
  let resolve;
  const stale=cache.get('menu',()=>new Promise(done=>{resolve=done;}),1000);
  await Promise.resolve();
  cache.invalidate();
  await cache.get('menu',async()=> 'new',1000);
  resolve('old'); await stale;
  assert.equal(cache.peek('menu'),'new');
  await assert.rejects(cache.get('failed',async()=>{throw Error('offline');},1000));
  assert.equal(await cache.get('failed',async()=> 'recovered',1000),'recovered');
});
