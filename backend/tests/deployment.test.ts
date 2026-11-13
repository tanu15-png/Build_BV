import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/generated/prisma/client.js';

const base={DATABASE_URL:'postgresql://localhost/test',FRONTEND_ORIGIN:'http://localhost:5173',SESSION_SECRET:'s'.repeat(32),OTP_SECRET:'o'.repeat(32),LOG_LEVEL:'silent'};
test('production needs only the two active HTTPS origins and bounded explicit proxy trust',()=>{
  const config=loadConfig({...base,APP_ENV:'production',NODE_ENV:'production',DATABASE_URL:'postgresql://localhost/test?sslmode=verify-full',FRONTEND_ORIGIN:'https://students.example.edu',CANTEEN_ORIGIN:'https://canteen.example.edu',EMAIL_PROVIDER:'supabase',SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_123456789',TRUST_PROXY_HOPS:'1'});
  assert.equal(config.TRUST_PROXY_HOPS,1);
  assert.equal(config.ADMIN_ORIGIN,'http://localhost:5175');
  for(const value of ['-1','4','true'])assert.throws(()=>loadConfig({...base,TRUST_PROXY_HOPS:value}));
});

test('trusted proxy IPs keep independent login limits while direct access ignores spoofed forwarding',async()=>{
  for(const hops of [0,1]){
    const attempts=new Map<string,number>();
    const db={canteenAccessCode:{findMany:async()=>[]},$queryRaw:async(_sql:unknown,key:string)=>{const count=(attempts.get(key)||0)+1;attempts.set(key,count);return [{count}];}} as unknown as PrismaClient;
    const config=loadConfig({...base,TRUST_PROXY_HOPS:String(hops)});
    const server=createApp(config,db).listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');
    const root=`http://127.0.0.1:${address.port}/api/v1/canteen`;
    try{
      const csrf=await fetch(root+'/auth/csrf',{headers:{Origin:config.CANTEEN_ORIGIN}}),{csrfToken}=await csrf.json();
      for(let index=0;index<21;index++){
        const response=await fetch(root+'/auth/canteen/access',{method:'POST',headers:{Origin:config.CANTEEN_ORIGIN,'Content-Type':'application/json','X-CSRF-Token':csrfToken,Cookie:csrf.headers.getSetCookie()[0]!.split(';')[0]!,'X-Forwarded-For':`198.51.100.${index+1}`},body:JSON.stringify({name:'Member',accessCode:'wrong-code'})});
        assert.equal(response.status,hops===0&&index===20?429:401);
      }
      assert.equal(attempts.size,hops===0?1:21);
    }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
  }
});
