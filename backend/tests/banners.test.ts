import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerInput, bannerImageType, bannerSchedule } from '../src/services/banners.js';

const base={title:'Exam Season',imageRef:'/banners/exam-season-v1.png',active:true,targetType:'theme',itemIds:['aa38c416-2e7e-4440-a062-765be76cb28e']};
test('banner definitions require valid destinations, owned-menu references and safe image locations',()=>{
  assert.equal(bannerInput.safeParse(base).success,true);
  for(const patch of [{imageRef:'javascript:alert(1)'},{imageRef:'https://example.com/poster.svg'},{imageRef:'/banners/other.svg'},{itemIds:[]},{targetType:'item',targetId:null},{startsAt:'2026-11-14T10:00:00Z',endsAt:'2026-11-13T10:00:00Z'}])assert.equal(bannerInput.safeParse({...base,...patch}).success,false);
  assert.equal(bannerInput.safeParse({...base,targetType:'menu',itemIds:[]}).success,true);
});

test('cached banner definitions observe inclusive starts and exclusive ends without another database read',()=>{
  const start=Date.parse('2026-11-15T00:00:00Z'),end=start+1000;
  const rows=[{id:'banner',startsAt:new Date(start),endsAt:new Date(end)}];
  assert.equal(bannerSchedule(rows,start-1).items.length,0);
  assert.equal(bannerSchedule(rows,start).items.length,1);
  assert.equal(bannerSchedule(rows,end).items.length,0);
  assert.equal(bannerSchedule(rows,start).cacheUntil,new Date(end).toISOString());
  assert.equal(bannerInput.safeParse({...base,startsAt:'2026-11-15T00:00:00.000Z',endsAt:'2026-11-15T00:00:00Z'}).success,false);
});
test('poster uploads accept raster signatures and reject scripts and unsupported data',()=>{
  assert.equal(bannerImageType(Buffer.from([137,80,78,71,13,10,26,10])),'image/png');
  assert.equal(bannerImageType(Buffer.from([255,216,255,0])),'image/jpeg');
  assert.equal(bannerImageType(Buffer.from('RIFF0000WEBP')),'image/webp');
  assert.equal(bannerImageType(Buffer.from('<svg onload="alert(1)"></svg>')),null);
  assert.equal(bannerImageType(Buffer.alloc(0)),null);
});
