import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

test('automatic notification reads are student-only and constrained to the current recipient', async () => {
  const config=loadConfig({DATABASE_URL:'postgresql://localhost/test',FRONTEND_ORIGIN:'http://localhost:5173',SESSION_SECRET:'s'.repeat(32),OTP_SECRET:'o'.repeat(32),LOG_LEVEL:'silent'});
  const userId=randomUUID(), owned=randomUUID(), foreign=randomUUID();
  let role='STUDENT'; const writes: unknown[]=[];
  const db={
    session:{findUnique:async()=>({role,canteenId:randomUUID(),revokedAt:null,expiresAt:new Date(Date.now()+60000),user:{id:userId,email:role==='STUDENT'?'student@banasthali.in':'staff@example.edu',name:'Test',status:'ACTIVE',supabaseSubject:randomUUID(),roles:[{role}]},membership:{status:'ACTIVE',codeVersion:1},canteen:{slug:'canteen',accessCodes:[{version:1}]}})},
    $queryRaw:async()=>[],
    $transaction:async(work:(tx:unknown)=>Promise<unknown>)=>work(db),
    notification:{
      updateMany:async(query:unknown)=>{writes.push(query);return {count:1};},
      findMany:async({where}:{where:{recipientId:string}})=>{assert.equal(where.recipientId,userId);return [{id:owned,orderId:randomUUID(),type:'READY',message:'Ready',createdAt:new Date(),readAt:new Date()}];},
      count:async({where}:{where:{recipientId:string}})=>{assert.equal(where.recipientId,userId);return 0;},
    },
  } as unknown as PrismaClient;
  const server=createApp(config,db).listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');
  async function open(portal:'student'|'canteen') {
    const base=`http://127.0.0.1:${(address as {port:number}).port}/api/v1/${portal}`,origin=portal==='student'?config.FRONTEND_ORIGIN:config.CANTEEN_ORIGIN;
    const csrf=await fetch(base+'/auth/csrf',{headers:{Origin:origin}});const {csrfToken}=await csrf.json();
    return fetch(base+'/notifications/read',{method:'PATCH',headers:{Origin:origin,'Content-Type':'application/json','X-CSRF-Token':csrfToken,Cookie:`spoonate_${portal}_session=${'a'.repeat(64)}; ${csrf.headers.getSetCookie()[0]!.split(';')[0]}`},body:JSON.stringify({ids:[owned,foreign]})});
  }
  try {
    const result=await open('student');assert.equal(result.status,200);const page=await result.json();assert.deepEqual(page.items.map((item:{id:string})=>item.id),[owned]);
    assert.deepEqual((writes[0] as {where:unknown}).where,{id:{in:[owned,foreign]},recipientId:userId,readAt:null});
    role='CANTEEN';assert.equal((await open('canteen')).status,403);assert.equal(writes.length,1);
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
