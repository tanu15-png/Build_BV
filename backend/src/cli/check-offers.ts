import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { loadConfig } from '../config/env.js';
import { createPrisma } from '../lib/prisma.js';
import { saveOffer, priceFor } from '../services/offers.js';
import { cartInclude, cartResponse, verifyCartQuote } from '../services/cart.js';
import { allocateOrder, orderInclude, orderResponse } from '../services/orders.js';
import { tokenSummary } from '../routes/rewards.routes.js';
import { contracts } from '../schemas/contracts.js';
import { createApp } from '../app.js';

async function main(){
  const config={...loadConfig(),DB_TIMEOUT_MS:10000,LOG_LEVEL:'silent' as const},db=createPrisma(config);
  const marker=randomUUID(),rollback=new Error('verification rollback');
  let stage='database';
  try{
    await assert.rejects(db.$transaction(async tx=>{
      const canteen=await tx.canteen.findUniqueOrThrow({where:{slug:'canteen'}});
      await tx.$queryRaw`SELECT id FROM canteens WHERE id=${canteen.id}::uuid FOR UPDATE`;
      await tx.canteen.update({where:{id:canteen.id},data:{operational:true,acceptingOrders:true}});
      const category=await tx.menuCategory.findFirstOrThrow({where:{canteenId:canteen.id,archived:false}});
      const item=await tx.menuItem.create({data:{id:marker,canteenId:canteen.id,categoryId:category.id,name:'Temporary offer verification',pricePaise:10000}});
      const now=new Date(),endsAt=new Date(now.getTime()+60000);
      stage='offer permissions, overlap and price';
      const body={menuItemId:item.id,name:'Verification only',kind:'PERCENT' as const,value:2500,active:true,startsAt:new Date(now.getTime()-1000).toISOString(),endsAt:endsAt.toISOString()};
      const offer=await saveOffer(tx,canteen.id,body);
      await assert.rejects(saveOffer(tx,canteen.id,body),{code:'OFFER_OVERLAP'});
      stage='cart quotes';
      const user=await tx.user.create({data:{email:`offer-check-${marker}@banasthali.in`,name:'Temporary verification'}});
      const cart=await tx.cart.create({data:{studentId:user.id,canteenId:canteen.id,items:{create:{menuItemId:item.id,quantity:2}}},include:cartInclude});
      const summary=cartResponse(cart,config,now.getTime());
      contracts['GET /cart']!.response.parse(summary);
      assert.equal(summary.totalPaise,15000);assert.equal(summary.quoteExpiresAt,endsAt.toISOString());
      verifyCartQuote(summary.quote,summary,user.id,config);
      assert.throws(()=>verifyCartQuote(summary.quote,cartResponse(cart,config,endsAt.getTime()),user.id,config),{code:'QUOTE_CHANGED'});
      stage='banner associations';
      const banner=await tx.banner.create({data:{canteenId:canteen.id,title:'Temporary offer verification',description:'',imageRef:'/banners/exam-season-v1.png',active:false,targetType:'theme',items:{create:{menuItemId:item.id}},offers:{create:{offerId:offer.id}}},include:{offers:true}});
      assert.equal(banner.offers[0]?.offerId,offer.id);
      stage='order snapshots and token earning';
      const orderId=await allocateOrder(tx,{studentId:user.id,canteenId:canteen.id,totalPaise:summary.totalPaise,pickupAt:now,now},{});
      await tx.orderItem.createMany({data:summary.items.map(line=>({orderId,menuItemId:line.menuItemId,name:line.name,quantity:line.quantity,unitPricePaise:line.unitPricePaise,originalUnitPricePaise:line.originalUnitPricePaise,offerId:line.offer?.id,offerName:line.offer?.name}))});
      await tx.order.update({where:{id:orderId},data:{status:'COLLECTED',collectedAt:now,pickupVerifiedBy:user.id}});
      assert.equal((await tokenSummary(tx,user.id)).earned,15);
      await tx.offer.delete({where:{id:offer.id}});
      const snapshot=orderResponse(await tx.order.findUniqueOrThrow({where:{id:orderId},include:orderInclude}));
      contracts['GET /orders/:id']!.response.parse(snapshot);
      assert.equal(snapshot.items[0]?.unitPricePaise,7500);assert.equal(snapshot.items[0]?.offerId,offer.id);
      assert.equal(await tx.bannerOffer.count({where:{bannerId:banner.id}}),0);
      assert.equal(priceFor(await tx.menuItem.findUniqueOrThrow({where:{id:item.id},include:{offers:true}})).effectivePricePaise,10000);
      throw rollback;
    },{maxWait:10000,timeout:60000}),error=>{if(error!==rollback){const e=error as {name?:string;code?:string;message?:string};console.error(JSON.stringify({stage,name:e.name,code:e.code,...(['AssertionError','ZodError','AppError'].includes(e.name||'')?{message:e.message}: {})}));}return error===rollback;});
    assert.equal(await db.menuItem.findUnique({where:{id:marker}}),null);
    stage='public endpoints';
    const server=createApp(config,db).listen(0,'127.0.0.1');await once(server,'listening');
    try{
      const address=server.address();assert(address&&typeof address!=='string');
      const root=`http://127.0.0.1:${address.port}/api/v1/student`;
      const catalog=await fetch(`${root}/catalog`,{signal:AbortSignal.timeout(20000)});assert.equal(catalog.status,200);contracts['GET /catalog']!.response.parse(await catalog.json());
      assert.equal((await fetch(`${root}/banners`)).status,200);
    }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
    console.log('PASS: live offer writes, overlap prevention, discounted cart, expiry, banner links, immutable order prices, token totals, public endpoints and rollback');
  }catch(error){const issue=error as {name?:string;code?:string};console.error(JSON.stringify({stage,name:issue.name,code:issue.code}));process.exitCode=1;}
  finally{await db.$disconnect();}
}
void main();
