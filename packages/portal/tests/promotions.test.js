import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerHref,bannerImageSrc,bannerBody } from '../src/services/promotions.js';

test('banners route taps to their configured special menu, item, combo or category',()=>{
  assert.equal(bannerHref({id:'birthday',targetType:'theme'}),'/dashboard/specials/birthday');
  assert.equal(bannerHref({targetType:'menu'}),'/dashboard#cafes');
  assert.equal(bannerHref({targetType:'item',targetId:'combo-id'}),'/dashboard?item=combo-id#cafes');
  assert.equal(bannerHref({targetType:'category',targetId:'category-id'}),'/dashboard?category=category-id#cafes');
  assert.equal(bannerImageSrc('/banners/exam-season-v1.png'),'/banners/exam-season-v1.png');
  assert.match(bannerImageSrc('/banners/images/image-id'),/^\/api\/v1\/student\/banners\/images\/image-id$/);
});
test('editing a banner preserves its current menu selection and concurrency version',()=>{
  const body=bannerBody({title:'Birthday',description:'Celebrate',imageRef:'/poster.png',active:false,targetType:'theme',targetId:null,items:[{menuItemId:'pizza'},{menuItemId:'shake'}],startsAt:null,endsAt:null,version:4});
  assert.deepEqual(body.itemIds,['pizza','shake']);assert.equal(body.expectedVersion,4);assert.equal(body.active,false);
});
