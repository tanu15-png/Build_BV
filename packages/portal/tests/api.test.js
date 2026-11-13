import test from 'node:test';
import assert from 'node:assert/strict';
import { api, setApiCacheScope } from '../src/services/api.js';
test('API requests distinguish a slow response timeout from a failed connection', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
    await assert.rejects(api('/notifications'), error => error.code === 'REQUEST_TIMEOUT' && error.status === 504 && /too long/.test(error.message));
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(api('/notifications'), error => error.code === 'NETWORK_ERROR' && error.status === 503);
    globalThis.fetch = async () => Response.json({ items: [], unreadCount: 0, nextCursor: null });
    assert.deepEqual(await api('/notifications'), { items: [], unreadCount: 0, nextCursor: null });
  } finally { globalThis.fetch = original; }
});

test('private token caches reset on account changes and mutations invalidate reads', async () => {
  const original=globalThis.fetch;
  let reads=0;
  try {
    globalThis.fetch=async url=>Response.json(String(url).endsWith('/auth/csrf') ? {csrfToken:'test'} : String(url).endsWith('/rewards') ? {balance:++reads} : {ok:true});
    setApiCacheScope('student-a');
    assert.equal((await api('/rewards')).balance,1);
    assert.equal((await api('/rewards')).balance,1);
    setApiCacheScope('student-b');
    assert.equal((await api('/rewards')).balance,2);
    await api('/rewards/manage',{method:'POST',body:{}});
    assert.equal((await api('/rewards')).balance,3);
    assert.equal((await api('/rewards',{fresh:true})).balance,4);
  } finally {setApiCacheScope('');globalThis.fetch=original;}
});

test('poster uploads send binary image data rather than JSON encoding it',async()=>{
  const original=globalThis.fetch,poster=new Blob(['RIFF0000WEBP'],{type:'image/webp'});
  try {
    globalThis.fetch=async(url,options)=>{
      if(String(url).endsWith('/auth/csrf'))return Response.json({csrfToken:'test'});
      assert.equal(options.body,poster);assert.equal(options.headers['Content-Type'],'image/webp');
      return Response.json({imageRef:'/banners/images/image-id'});
    };
    assert.deepEqual(await api('/banners/images',{method:'POST',body:poster}),{imageRef:'/banners/images/image-id'});
  } finally {globalThis.fetch=original;}
});
