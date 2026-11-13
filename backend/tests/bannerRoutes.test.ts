import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

test('banner reads filter publications, uploads stay staff-only, and linked menu items are scoped',async()=>{
  const config=loadConfig({DATABASE_URL:'postgresql://localhost/test',FRONTEND_ORIGIN:'http://localhost:5173',SESSION_SECRET:'s'.repeat(32),OTP_SECRET:'o'.repeat(32),LOG_LEVEL:'silent'});
  const canteenId=randomUUID(),imageId=randomUUID();let role='CANTEEN',uploads=0;const queries:unknown[]=[];
  const db={
    session:{findUnique:async()=>({role,canteenId,revokedAt:null,expiresAt:new Date(Date.now()+60000),user:{id:randomUUID(),email:role==='STUDENT'?'student@banasthali.in':'staff@example.edu',name:'Test',status:'ACTIVE',supabaseSubject:randomUUID(),roles:[{role}]},membership:{status:'ACTIVE',codeVersion:1},canteen:{slug:'canteen',accessCodes:[{version:1}]}})},
    $queryRaw:async()=>[], $transaction:async(work:(tx:unknown)=>Promise<unknown>)=>work(db),
    banner:{findMany:async(query:unknown)=>{queries.push(query);return [];},create:()=>assert.fail('foreign item must not be linked')},
    menuItem:{count:async()=>0},
    bannerImage:{create:async({data}:{data:{mime:string;data:Uint8Array}})=>{uploads++;assert.equal(data.mime,'image/png');assert.equal(data.data.length,8);return {id:imageId};}},
  } as unknown as PrismaClient;
  const server=createApp(config,db).listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');
  const root=`http://127.0.0.1:${address.port}/api/v1`;
  async function write(portal:'student'|'canteen',path:string,body:Buffer|object,type:string){
    const origin=portal==='canteen'?config.CANTEEN_ORIGIN:config.FRONTEND_ORIGIN;
    const csrf=await fetch(`${root}/${portal}/auth/csrf`,{headers:{Origin:origin}});const {csrfToken}=await csrf.json();
    return fetch(`${root}/${portal}${path}`,{method:'POST',headers:{Origin:origin,'Content-Type':type,'X-CSRF-Token':csrfToken,Cookie:`spoonate_${portal}_session=${'a'.repeat(64)}; ${csrf.headers.getSetCookie()[0]!.split(';')[0]}`},body:Buffer.isBuffer(body)?body:JSON.stringify(body)});
  }
  try{
    assert.equal((await fetch(`${root}/student/banners`)).status,200);
    const publicQuery=queries[0] as {where:{active:boolean;AND:unknown[]};orderBy:unknown};assert.equal(publicQuery.where.active,true);assert.deepEqual(publicQuery.orderBy,[{publishedAt:'desc'},{id:'desc'}]);
    const png=Buffer.from([137,80,78,71,13,10,26,10]);
    const upload=await write('canteen','/banners/images',png,'image/png');assert.equal(upload.status,201);assert.deepEqual(await upload.json(),{imageRef:`/banners/images/${imageId}`});
    const foreign=await write('canteen','/banners',{title:'Exam Season',imageRef:'/banners/exam-season-v1.png',active:true,targetType:'theme',itemIds:[randomUUID()]},'application/json');assert.equal(foreign.status,422);
    role='STUDENT';assert.equal((await write('student','/banners/images',png,'image/png')).status,403);assert.equal(uploads,1);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
