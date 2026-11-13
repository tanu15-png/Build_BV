import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/env.js';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
test('retired admin endpoints never reach database or permit sign-in',async()=>{
 const config=loadConfig({DATABASE_URL:'postgresql://localhost/test',FRONTEND_ORIGIN:'http://localhost:5173',SESSION_SECRET:'s'.repeat(32),OTP_SECRET:'o'.repeat(32),LOG_LEVEL:'silent'});
 const db=new Proxy({},{get(){throw Error('Retired portal must not query the database');}}) as PrismaClient;
 const server=createApp(config,db).listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert(address&&typeof address!=='string');
 try{for(const path of ['/auth/csrf','/auth/me','/orders','/admin/canteens'])assert.equal((await fetch(`http://127.0.0.1:${address.port}/api/v1/admin${path}`)).status,404);}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
