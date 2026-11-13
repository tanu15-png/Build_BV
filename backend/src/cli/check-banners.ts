import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createPrisma } from '../lib/prisma.js';
import { loadConfig } from '../config/env.js';
import { createApp } from '../app.js';

async function main(){
  const config={...loadConfig(),DB_TIMEOUT_MS:10000,LOG_LEVEL:'silent' as const},db=createPrisma(config);
  const server=createApp(config,db).listen(0,'127.0.0.1');
  try{
    await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');
    const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/student/banners`,{signal:AbortSignal.timeout(20000)});
    assert.equal(response.status,200);const page=await response.json();
    assert(Array.isArray(page.items));
    // Owners may legitimately pause/delete every promotion. Validate those published now.
    for(const item of page.items){assert(item.active&&Array.isArray(item.items));assert(!item.startsAt||Date.parse(item.startsAt)<=Date.now());assert(!item.endsAt||Date.parse(item.endsAt)>Date.now());}
    const imageId=randomUUID(),rollback=new Error('verification rollback');
    await assert.rejects(db.$transaction(async tx=>{
      await tx.bannerImage.create({data:{id:imageId,mime:'image/png',data:new Uint8Array([137,80,78,71,13,10,26,10])}});
      assert(await tx.bannerImage.findUnique({where:{id:imageId}}));
      throw rollback;
    },{maxWait:10000,timeout:30000}),error=>error===rollback);
    assert.equal(await db.bannerImage.findUnique({where:{id:imageId}}),null);
    console.log(JSON.stringify({publicBanners:page.items.map((item:{title:string;items:unknown[]})=>({title:item.title,menuItems:item.items.length})),imageStorage:'write/read permissions and rollback verified'}));
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));await db.$disconnect();}
}
void main().catch(error=>{const issue=error as {code?:string;name?:string};console.error(JSON.stringify({name:issue.name,code:issue.code}));process.exitCode=1;});
