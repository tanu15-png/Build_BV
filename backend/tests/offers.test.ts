import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { offerInput, offerPrice, priceFor, nextOfferBoundary, saveOffer } from '../src/services/offers.js';
import { cartResponse, verifyCartQuote } from '../src/services/cart.js';
import type { Prisma } from '../src/generated/prisma/client.js';
import type { Config } from '../src/config/env.js';

const start=Date.parse('2026-11-13T00:00:00Z'),end=start+86400000;
const offer={id:randomUUID(),menuItemId:randomUUID(),name:'Study break',kind:'PERCENT',value:1500,active:true,startsAt:new Date(start),endsAt:new Date(end),version:1};
test('discounts use integer paise and never exceed the normal price',()=>{
  assert.equal(offerPrice(9999,offer),8500);
  assert.equal(offerPrice(9999,{kind:'AMOUNT',value:2000}),7999);
  assert.equal(offerPrice(9999,{kind:'FIXED',value:5000}),5000);
  assert.equal(offerPrice(1000,{kind:'FIXED',value:2000}),1000);
  assert.equal(offerPrice(1000,{kind:'AMOUNT',value:2000}),0);
});
test('offers are active only within their window and cache boundaries include scheduled starts',()=>{
  const item={pricePaise:10000,offers:[offer]};
  assert.equal(priceFor(item,start-1).offer,null);
  assert.equal(priceFor(item,start).effectivePricePaise,8500);
  assert.equal(priceFor(item,end-1).effectivePricePaise,8500);
  assert.equal(priceFor(item,end).offer,null);
  assert.equal(priceFor({...item,offers:[{...offer,active:false}]},start).offer,null);
  assert.equal(nextOfferBoundary([item],start-1),new Date(start).toISOString());
  assert.equal(nextOfferBoundary([item],start),new Date(end).toISOString());
});
test('offer validation rejects invalid schedules, percentages and competing offers',async()=>{
  const body={...offer,startsAt:offer.startsAt.toISOString(),endsAt:offer.endsAt.toISOString()};
  assert(offerInput.safeParse(body).success);
  for(const patch of [{endsAt:body.startsAt},{value:10001},{value:0},{kind:'AMOUNT',value:0}])assert(!offerInput.safeParse({...body,...patch}).success);
  const tx={menuItem:{findFirst:async()=>({id:offer.menuItemId,pricePaise:10000,name:'Coffee',archived:false,category:{archived:false}})},offer:{findFirst:async()=>offer}} as unknown as Prisma.TransactionClient;
  const {id:_,...creating}=body;
  await assert.rejects(saveOffer(tx,randomUUID(),creating),{code:'OFFER_OVERLAP'});
  await assert.rejects(saveOffer(tx,randomUUID(),{...body,expectedVersion:4}),{code:'VERSION_CONFLICT'});
  await assert.rejects(saveOffer(tx,randomUUID(),{...creating,kind:'FIXED',value:11000}),{code:'OFFER_PRICE_INVALID'});
});
test('cart quotes expire at an offer boundary and cannot charge the expired discount',()=>{
  const config={SESSION_SECRET:'test'.repeat(10)} as Config;
  const now=Date.now(),ends=new Date(now+100000);
  const cart={id:randomUUID(),studentId:randomUUID(),canteenId:randomUUID(),version:1,canteen:{slug:'canteen',operational:true,acceptingOrders:true,version:1},items:[{id:randomUUID(),menuItemId:offer.menuItemId,canteenId:randomUUID(),quantity:2,menuItem:{name:'Coffee',pricePaise:10000,categoryId:randomUUID(),category:{name:'Drinks',version:1,archived:false},description:null,imageRef:null,available:true,archived:false,version:1,offers:[{...offer,startsAt:new Date(now-1000),endsAt:ends}]}}]} as unknown as Parameters<typeof cartResponse>[0];
  const quoted=cartResponse(cart,config,now);
  assert.equal(quoted.totalPaise,17000);assert.equal(quoted.quoteExpiresAt,ends.toISOString());
  verifyCartQuote(quoted.quote,quoted,cart.studentId,config);
  const expired=cartResponse(cart,config,ends.getTime());
  assert.equal(expired.totalPaise,20000);
  assert.throws(()=>verifyCartQuote(quoted.quote,expired,cart.studentId,config),{code:'QUOTE_CHANGED'});
});
