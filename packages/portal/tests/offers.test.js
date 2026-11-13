import test from 'node:test';
import assert from 'node:assert/strict';
import { offerBody,offerDraft,offerStatus } from '../src/services/offers.js';
import { mapCatalog } from '../src/services/catalog.js';
import { addCartItem } from '../src/services/cartChanges.js';
import { createReadCache } from '../src/services/readCache.js';

test('offer forms use exact paise and inclusive date-only ends in campus time',()=>{
  const draft={...offerDraft(),name:'Coffee deal',menuItemId:'coffee',amount:'12.50',startsAt:'2026-11-13',endsAt:'2026-11-14'};
  const body=offerBody(draft);
  assert.equal(body.value,1250);assert.equal(body.startsAt,'2026-11-12T18:30:00.000Z');assert.equal(body.endsAt,'2026-11-14T18:30:00.000Z');
  assert.throws(()=>offerBody({...draft,amount:'12.555'}));
  assert.equal(offerStatus({...body,active:false}),'Paused');
  assert.equal(offerDraft({...body,value:1250}).startsAt,'2026-11-13T00:00');
});
test('catalog and optimistic cart agree on discounted prices',()=>{
  const item={id:'coffee',canteenId:'c',pricePaise:10000,effectivePricePaise:8000,available:true,offer:{name:'Coffee deal'}};
  const canteen={id:'c',slug:'canteen',operational:true,acceptingOrders:true};
  assert.equal(mapCatalog({canteens:[canteen],categories:[],items:[item]}).foods[0].price,80);
  const cart=addCartItem(null,item,canteen);assert.equal(cart.totalPaise,8000);assert.equal(cart.items[0].originalUnitPricePaise,10000);assert.equal(cart.items[0].offer.name,'Coffee deal');
});
test('cached catalog expires precisely at the next offer start or end',async()=>{
  let now=1000,reads=0;const cache=createReadCache({now:()=>now});
  const read=()=>{reads++;return {cacheUntil:new Date(1500).toISOString()};};
  await cache.get('catalog',read,60000);now=1499;await cache.get('catalog',read,60000);assert.equal(reads,1);
  now=1500;await cache.get('catalog',read,60000);assert.equal(reads,2);
});
