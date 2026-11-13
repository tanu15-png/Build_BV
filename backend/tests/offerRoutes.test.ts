import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

test('offers require staff ownership, valid inputs and concurrency versions',async()=>{
  const config=loadConfig({DATABASE_URL:'postgresql://localhost/test',FRONTEND_ORIGIN:'http://localhost:5173',SESSION_SECRET:'s'.repeat(32),OTP_SECRET:'o'.repeat(32),LOG_LEVEL:'silent'});
  const canteenId=randomUUID(),itemId=randomUUID(),offerId=randomUUID();let role='CANTEEN',owned=true,deletes=0;
  const record={id:offerId,canteenId,menuItemId:itemId,name:'Coffee deal',kind:'AMOUNT',value:1000,active:true,startsAt:new Date(),endsAt:new Date(Date.now()+86400000),version:1};
  const db={
    session:{findUnique:async()=>({role,canteenId,revokedAt:null,expiresAt:new Date(Date.now()+60000),user:{id:randomUUID(),email:role==='STUDENT'?'student@banasthali.in':'staff@example.edu',name:'Test',status:'ACTIVE',supabaseSubject:randomUUID(),roles:[{role}]},membership:{status:'ACTIVE',codeVersion:1},canteen:{slug:'canteen',accessCodes:[{version:1}]}})},
    $queryRaw:async()=>[], $transaction:async(work:(tx:unknown)=>Promise<unknown>)=>work(db),
    menuItem:{findFirst:async()=>owned?{id:itemId,pricePaise:10000,archived:false,category:{archived:false}}:null},
    offer:{findMany:async(query:{where:{canteenId:string}})=>{assert.equal(query.where.canteenId,canteenId);return [record];},findFirst:async(query:{where:{id?:unknown}})=>typeof query.where.id==='string'?owned?record:null:null,create:async()=>record,delete:async()=>{deletes++;}},
  } as unknown as PrismaClient;
  const server=createApp(config,db).listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');
  const root=`http://127.0.0.1:${address.port}/api/v1`;
  async function request(method:string,path:string,body?:object){
    const portal=role==='STUDENT'?'student':'canteen',origin=portal==='student'?config.FRONTEND_ORIGIN:config.CANTEEN_ORIGIN;
    const csrf=await fetch(`${root}/${portal}/auth/csrf`,{headers:{Origin:origin}});const {csrfToken}=await csrf.json();
    return fetch(`${root}/${portal}${path}`,{method,headers:{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrfToken,Cookie:`spoonate_${portal}_session=${'a'.repeat(64)}; ${csrf.headers.getSetCookie()[0]!.split(';')[0]}`},...(body?{body:JSON.stringify(body)}:{})});
  }
  const body={...record,startsAt:record.startsAt.toISOString(),endsAt:record.endsAt.toISOString()};
  try{
    role='STUDENT';assert.equal((await request('GET','/offers/manage')).status,403);assert.equal((await request('POST','/offers',body)).status,403);
    role='CANTEEN';assert.equal((await request('GET','/offers/manage')).status,200);
    assert.equal((await request('POST','/offers',{name:'Invalid'})).status,422);
    const {id:_,...creating}=body;
    owned=false;assert.equal((await request('POST','/offers',creating)).status,422);
    owned=true;assert.equal((await request('POST','/offers',creating)).status,201);
    assert.equal((await request('PATCH',`/offers/${offerId}`,{...body,expectedVersion:4})).status,409);
    owned=false;assert.equal((await request('DELETE',`/offers/${offerId}`,{expectedVersion:1})).status,404);assert.equal(deletes,0);
    owned=true;assert.equal((await request('DELETE',`/offers/${offerId}`,{expectedVersion:1})).status,200);assert.equal(deletes,1);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
