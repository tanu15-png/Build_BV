import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';

const url=process.env.INTEGRATION_DATABASE_URL;assert(url,'Set the dedicated local integration database URL.');
const target=new URL(url);assert(['localhost','127.0.0.1'].includes(target.hostname)&&target.pathname.includes('test'));
const probe=createServer().listen(0,'127.0.0.1');await once(probe,'listening');const address=probe.address();assert(address&&typeof address!=='string');const port=address.port;await new Promise(resolve=>probe.close(resolve));
const child=spawn(process.execPath,['dist/server.js'],{env:{...process.env,DATABASE_URL:url,PORT:String(port),APP_ENV:'test',NODE_ENV:'test',FRONTEND_ORIGIN:'http://localhost:5173',SESSION_SECRET:'s'.repeat(32),OTP_SECRET:'o'.repeat(32),LOG_LEVEL:'silent'},stdio:['ignore','pipe','pipe']});
const exited=once(child,'exit');let timer;let errorText='';child.stderr.on('data',chunk=>{errorText+=chunk.toString();});
try{
 await Promise.race([once(child.stdout,'data'),exited.then(([code])=>{throw Error('API exited before startup: '+code+' '+errorText.slice(0,1000));}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('API startup deadline exceeded')),30000);})]);clearTimeout(timer);
 const response=await fetch(`http://127.0.0.1:${port}/api/v1/student/catalog/events`),reader=response.body.getReader();await reader.read();
 child.kill('SIGTERM');
 const [code]=await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Event stream blocked shutdown')),4000);})]);clearTimeout(timer);assert.equal(code,0);await reader.cancel();
 console.log('PASS: API exits cleanly on SIGTERM with a connected event stream');
}finally{clearTimeout(timer);if(child.exitCode===null)child.kill('SIGKILL');}
