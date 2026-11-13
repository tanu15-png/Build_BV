import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID,randomBytes,createHmac } from 'node:crypto';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import { createPrisma } from '../../src/lib/prisma.js';
import { seed } from '../../src/services/provision.js';
import { createOutboxWorker } from '../../src/services/outbox.js';
import { cartSchema,orderSchema,contracts } from '../../src/schemas/contracts.js';
import { foreignCanteen } from './support.js';

const url=process.env.COMMERCE_TEST_DATABASE_URL;
test('offers, combos, promotions, ordering and tokens work together through the real API',{skip:!url},async t=>{
  assert(url);const address=new URL(url);assert(['localhost','127.0.0.1'].includes(address.hostname)&&address.pathname.includes('test'));assert.notEqual(url,process.env.DATABASE_URL);
  const migration=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...process.env,DATABASE_URL:url,MIGRATION_DATABASE_URL:url},encoding:'utf8',timeout:180000});assert.equal(migration.status,0,migration.stderr);
  const config=loadConfig({DATABASE_URL:url,FRONTEND_ORIGIN:'http://localhost:5173',APP_ENV:'test',NODE_ENV:'test',SESSION_SECRET:'s'.repeat(32),OTP_SECRET:'o'.repeat(32),SEED_DEVELOPMENT_DATA:'true',DB_TIMEOUT_MS:'10000',LOG_LEVEL:'silent'});
  const db=createPrisma(config);await seed(db,config);const canteen=await db.canteen.findUniqueOrThrow({where:{slug:'canteen'}});
  const server=createApp(config,db).listen(0,'127.0.0.1');await once(server,'listening');const socket=server.address();assert(socket&&typeof socket!=='string');const root=`http://127.0.0.1:${socket.port}/api/v1`;
  class Browser{
    jar=new Map<string,string>();csrf='';constructor(readonly portal='student'){}
    async request(path:string,method='GET',body?:object,key?:string){
      const response=await fetch(`${root}/${this.portal}${path}`,{method,headers:{Origin:this.portal==='canteen'?config.CANTEEN_ORIGIN:config.FRONTEND_ORIGIN,Cookie:[...this.jar].map(([k,v])=>`${k}=${v}`).join('; '),'Content-Type':'application/json','X-CSRF-Token':this.csrf,...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
      for(const cookie of response.headers.getSetCookie()){const [k,v]=cookie.split(';')[0]!.split('=');this.jar.set(k!,v!);}
      return {status:response.status,body:await response.json()};
    }
    async prepare(){this.csrf=(await this.request('/auth/csrf')).body.csrfToken;return this;}
  }
  const staff=await new Browser('canteen').prepare();assert.equal((await staff.request('/auth/canteen/access','POST',{name:'Owner',accessCode:'shanu'})).status,200);
  const user=await db.user.create({data:{name:'Commerce Student',email:'commerce@banasthali.in',supabaseSubject:randomUUID(),emailVerifiedAt:new Date(),roles:{create:{role:'STUDENT'}}}});
  const token=randomBytes(32).toString('hex');await db.session.create({data:{userId:user.id,role:'STUDENT',tokenHash:createHmac('sha256',config.SESSION_SECRET).update(`session:${token}`).digest('hex'),expiresAt:new Date(Date.now()+3600000)}});
  const student=await new Browser().prepare();student.jar.set('spoonate_student_session',token);
  const cart=async()=>{const r=await student.request('/cart');assert.equal(r.status,200);return cartSchema.parse(r.body);};
  const rewards=async()=>{const r=await student.request('/rewards');assert.equal(r.status,200);return r.body;};
  async function advance(order:{id:string;version:number},action:string){const r=await staff.request(`/orders/${order.id}/${action}`,'POST',{expectedVersion:order.version},randomUUID());assert.equal(r.status,200,JSON.stringify(r.body));return orderSchema.parse(r.body);}
  let comboId:string,offerId:string,bannerId:string,rewardId:string,paid:ReturnType<typeof orderSchema.parse>;
  const window={startsAt:new Date(Date.now()-60000).toISOString(),endsAt:new Date(Date.now()+86400000).toISOString()};
  try{
    await t.test('owner creates a combo, timed offer and linked banner; students cannot manage them',async()=>{
      const category=await staff.request(`/canteens/${canteen.id}/categories`,'POST',{name:'Combos'});assert.equal(category.status,201);
      const combo=await staff.request(`/canteens/${canteen.id}/menu`,'POST',{name:'Coffee and sandwich',description:'One of each',categoryId:category.body.id,pricePaise:15000});assert.equal(combo.status,201);comboId=combo.body.id;
      const body={menuItemId:comboId,name:'Study deal',kind:'PERCENT',value:2000,active:true,...window};
      assert.equal((await student.request('/offers','POST',body)).status,403);
      const offer=await staff.request('/offers','POST',body);assert.equal(offer.status,201);offerId=offer.body.id;
      assert.equal((await staff.request('/offers','POST',body)).status,409);
      const banner=await staff.request('/banners','POST',{title:'Exam season',description:'Take a study break',imageRef:'/banners/exam-season-v1.png',active:true,targetType:'theme',itemIds:[comboId],offerIds:[offerId],...window});assert.equal(banner.status,201);bannerId=banner.body.id;
      const catalog=await student.request('/catalog');contracts['GET /catalog']!.response.parse(catalog.body);
      const item=catalog.body.items.find((i:{id:string})=>i.id===comboId);assert.equal(item.effectivePricePaise,12000);assert.equal(item.offer.id,offerId);assert(catalog.body.cacheUntil);
      assert.equal((await student.request('/banners')).body.items[0].id,bannerId);
    });
    await t.test('banner edits are atomic, preserve linked offers and never publish foreign items',async()=>{
      const foreign=await foreignCanteen(db);const foreignItem=await db.menuItem.findFirstOrThrow({where:{canteenId:foreign.id}});
      const before=await db.offer.count();
      const invalid=await staff.request('/banners','POST',{title:'Invalid',imageRef:'/banners/exam-season-v1.png',active:true,targetType:'theme',itemIds:[comboId],offers:[{menuItemId:foreignItem.id,name:'Foreign',kind:'AMOUNT',value:100,active:true,...window}]});assert.equal(invalid.status,422);assert.equal(await db.offer.count(),before);assert.equal(await db.banner.count({where:{title:'Invalid'}}),0);
      const managed=(await staff.request('/banners/manage')).body.items.find((b:{id:string})=>b.id===bannerId);
      const edit={...managed,offers:[],itemIds:managed.items.map((i:{menuItemId:string})=>i.menuItemId),offerIds:managed.offers.map((o:{offerId:string})=>o.offerId),expectedVersion:managed.version,active:false};
      assert.equal((await staff.request(`/banners/${bannerId}`,'PATCH',edit)).status,200);
      assert.equal((await student.request('/banners')).body.items.length,0);
      assert.equal((await student.request('/catalog')).body.items.find((i:{id:string})=>i.id===comboId).effectivePricePaise,12000);
      assert.equal((await staff.request(`/banners/${bannerId}`,'PATCH',{...edit,expectedVersion:managed.version+1,active:true})).status,200);
    });
    await t.test('discounted checkout snapshots the charged price and safe retries create one order',async()=>{
      const current=await cart();const added=await student.request('/cart/items','POST',{expectedVersion:current.version,menuItemId:comboId,quantity:1});assert.equal(added.status,200);assert.equal(added.body.totalPaise,12000);
      assert.equal((await rewards()).balance,0);
      const body={expectedVersion:added.body.version,quote:added.body.quote},key=randomUUID();
      const [a,b]=await Promise.all([student.request('/orders','POST',body,key),student.request('/orders','POST',body,key)]);assert.equal(a.status,201);assert.deepEqual(a,b);paid=orderSchema.parse(a.body);assert.equal(paid.totalPaise,12000);assert.equal(paid.items[0]?.offerId,offerId);assert.equal(paid.items[0]?.originalUnitPricePaise,15000);
      assert.equal((await rewards()).balance,0);assert.equal((await cart()).items.length,0);
      for(const action of ['accept','prepare','ready','collect'])paid=await advance(paid,action);
      assert.equal((await rewards()).balance,12);
    });
    await t.test('token cost changes invalidate stale redemption; concurrent purchases cannot overspend',async()=>{
      let r=await staff.request('/rewards/manage','POST',{menuItemId:comboId,tokenCost:5,active:true});assert.equal(r.status,200);rewardId=r.body.id;
      assert.equal((await staff.request('/rewards/manage','POST',{menuItemId:comboId,tokenCost:10,active:true})).status,200);
      assert.equal((await student.request('/rewards/redeem','POST',{rewardId,expectedTokenCost:5},randomUUID())).body.error.code,'REWARD_PRICE_CHANGED');
      const [a,b]=await Promise.all([student.request('/rewards/redeem','POST',{rewardId,expectedTokenCost:10},randomUUID()),student.request('/rewards/redeem','POST',{rewardId,expectedTokenCost:10},randomUUID())]);assert.deepEqual([a.status,b.status].sort(),[201,409]);
      const redeemed=orderSchema.parse((a.status===201?a:b).body);assert.equal(redeemed.totalPaise,0);assert.equal(redeemed.items[0]?.unitPricePaise,0);assert.equal((await rewards()).balance,2);
      await advance(redeemed,'reject');assert.equal((await rewards()).balance,12);
      const key=randomUUID(),body={rewardId,expectedTokenCost:10};const first=await student.request('/rewards/redeem','POST',body,key);const repeat=await student.request('/rewards/redeem','POST',body,key);assert.deepEqual(first,repeat);
      let collected=orderSchema.parse(first.body);for(const action of ['accept','prepare','ready','collect'])collected=await advance(collected,action);
      assert.equal((await rewards()).earned,12);assert.equal((await rewards()).balance,2);
    });
    await t.test('expired offers update the cart, reject old quotes and retain historical order prices',async()=>{
      const current=await cart();const added=await student.request('/cart/items','POST',{expectedVersion:current.version,menuItemId:comboId,quantity:1});assert.equal(added.body.totalPaise,12000);
      const offer=await db.offer.findUniqueOrThrow({where:{id:offerId}});
      const expired=await staff.request(`/offers/${offerId}`,'PATCH',{...offer,expectedVersion:offer.version,startsAt:new Date(Date.now()-3600000).toISOString(),endsAt:new Date(Date.now()-1000).toISOString()});assert.equal(expired.status,200);
      const stale=await student.request('/orders','POST',{expectedVersion:added.body.version,quote:added.body.quote},randomUUID());assert.equal(stale.status,409);assert.equal(stale.body.error.details.cart.totalPaise,15000);
      assert.equal((await cart()).totalPaise,15000);assert.equal((await student.request('/orders/'+paid.id)).body.items[0].unitPricePaise,12000);
      assert.equal((await staff.request(`/offers/${offerId}`,'DELETE',{expectedVersion:expired.body.version})).status,200);
      assert.equal((await student.request('/orders/'+paid.id)).body.items[0].offerId,offerId);
    });
    await t.test('durable notifications are delivered once and opening them marks only owned records read',async()=>{
      const worker=createOutboxWorker(db,config);while(await worker.runBatch()){};
      const feed=await student.request('/notifications');assert.equal(feed.status,200);assert(feed.body.items.length>0);assert(feed.body.unreadCount>0);
      const ids=feed.body.items.map((n:{id:string})=>n.id);const read=await student.request('/notifications/read','PATCH',{ids});assert.equal(read.status,200);assert.equal(read.body.unreadCount,0);
      const repeated=await student.request('/notifications/read','PATCH',{ids});assert.equal(repeated.body.unreadCount,0);
      assert.equal((await staff.request('/notifications/read','PATCH',{ids})).status,403);
      assert.equal(await worker.runBatch(),0);
    });
    await t.test('reward pause/delete and menu deletion keep balances and order snapshots intact',async()=>{
      assert.equal((await staff.request('/rewards/manage','POST',{menuItemId:comboId,tokenCost:10,active:false})).status,200);assert.equal((await rewards()).rewards.length,0);
      assert.equal((await staff.request(`/rewards/manage/${rewardId}`,'DELETE',{})).status,200);assert.equal((await rewards()).balance,2);
      const item=await db.menuItem.findUniqueOrThrow({where:{id:comboId}});assert.equal((await staff.request(`/menu-items/${comboId}`,'DELETE',{expectedVersion:item.version})).status,200);
      assert.equal((await cart()).items.length,0);const historical=await student.request('/orders/'+paid.id);assert.equal(historical.body.items[0].menuItemId,null);assert.equal(historical.body.items[0].unitPricePaise,12000);assert.equal((await rewards()).balance,2);
    });
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await db.$disconnect();}
});
