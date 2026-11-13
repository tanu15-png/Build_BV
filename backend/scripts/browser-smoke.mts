import assert from 'node:assert/strict';
import { createServer,request as proxyRequest } from 'node:http';
import { once } from 'node:events';
import { randomUUID,randomBytes,createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { loadConfig } from '../src/config/env.ts';
import { createPrisma } from '../src/lib/prisma.ts';
import { seed } from '../src/services/provision.ts';
import { createApp } from '../src/app.ts';

const raw=process.env.BROWSER_TEST_DATABASE_URL,modulePath=process.env.PLAYWRIGHT_MODULE_PATH;
assert(raw&&modulePath,'Explicit local test database and Playwright module path required.');
const address=new URL(raw);assert(['127.0.0.1','localhost'].includes(address.hostname)&&address.pathname.includes('test'));assert.notEqual(raw,process.env.DATABASE_URL);
const migration=spawnSync(process.execPath,['node_modules/prisma/build/index.js','migrate','deploy'],{env:{...process.env,DATABASE_URL:raw,MIGRATION_DATABASE_URL:raw},encoding:'utf8'});assert.equal(migration.status,0,migration.stderr);
const config=loadConfig({DATABASE_URL:raw,APP_ENV:'test',NODE_ENV:'test',FRONTEND_ORIGIN:'http://localhost:5188',CANTEEN_ORIGIN:'http://localhost:5189',SESSION_SECRET:'s'.repeat(32),OTP_SECRET:'o'.repeat(32),SEED_DEVELOPMENT_DATA:'true',LOG_LEVEL:'silent',DB_TIMEOUT_MS:'10000'});
const db=createPrisma(config);await seed(db,config);const canteen=await db.canteen.findUniqueOrThrow({where:{slug:'canteen'}});
const category=await db.menuCategory.create({data:{canteenId:canteen.id,name:'Combos'}});
const combo=await db.menuItem.create({data:{canteenId:canteen.id,categoryId:category.id,name:'Browser Coffee Combo',description:'Coffee and sandwich',pricePaise:15000}});
const tea=await db.menuItem.findFirstOrThrow({where:{name:'Sample Tea'}});
await db.offer.create({data:{canteenId:canteen.id,menuItemId:combo.id,name:'Study deal',kind:'PERCENT',value:2000,active:true,startsAt:new Date(Date.now()-60000),endsAt:new Date(Date.now()+86400000)}});
await db.reward.create({data:{canteenId:canteen.id,menuItemId:combo.id,tokenCost:10}});
for(const [index,title] of ['Exam Season','Sunday Funday','Birthday'].entries()){
 const theme=['exam-season','sunday-funday','birthday'][index]!;
 await db.banner.create({data:{canteenId:canteen.id,title,theme,imageRef:`/banners/${theme}-v1.png`,description:'Browser qualification menu',targetType:'theme',publishedAt:new Date(Date.now()-index*10000),items:{create:{menuItemId:combo.id}}}});
}
const user=await db.user.create({data:{email:'browser@banasthali.in',name:'Browser Student',supabaseSubject:randomUUID(),roles:{create:{role:'STUDENT'}}}});
const token=randomBytes(32).toString('hex');await db.session.create({data:{userId:user.id,role:'STUDENT',tokenHash:createHmac('sha256',config.SESSION_SECRET).update(`session:${token}`).digest('hex'),expiresAt:new Date(Date.now()+3600000)}});
const app=createApp(config,db),api=app.listen(0,'127.0.0.1');await once(api,'listening');const socket=api.address();assert(socket&&typeof socket!=='string');
const proxies=[];
for(const [port,vite] of [[5188,5173],[5189,5174]]){
 const proxy=createServer((req,res)=>{
  const upstream=proxyRequest({hostname:'127.0.0.1',port:req.url?.startsWith('/api/')?socket.port:vite,path:req.url,method:req.method,headers:req.headers},incoming=>{res.writeHead(incoming.statusCode||502,incoming.headers);incoming.pipe(res);});
  upstream.on('error',()=>{res.writeHead(502);res.end();});req.pipe(upstream);res.on('close',()=>upstream.destroy());
 });proxy.listen(port,'127.0.0.1');await once(proxy,'listening');proxies.push(proxy);
}
const {chromium}=await import(pathToFileURL(modulePath).href);
const browser=await chromium.launch({headless:true});const errors:string[]=[];
const studentContext=await browser.newContext({viewport:{width:1440,height:1000}}),staffContext=await browser.newContext({viewport:{width:1440,height:1000}});
await studentContext.addCookies([{name:'spoonate_student_session',value:token,domain:'localhost',path:'/api/v1/student',httpOnly:true,sameSite:'Lax'}]);
await staffContext.addInitScript(()=>{ const Audio=window.AudioContext; const original=Audio.prototype.createOscillator; (window as any).__orderTones=0; Audio.prototype.createOscillator=function(){const oscillator=original.call(this),start=oscillator.start.bind(oscillator);oscillator.start=(...args:any[])=>{(window as any).__orderTones++;return start(...args);};return oscillator;}; });
const student=await studentContext.newPage(),staff=await staffContext.newPage();
for(const page of [student,staff])page.on('pageerror',(error:Error)=>errors.push(error.message));
const out='../tmp/qualification';await mkdir(out,{recursive:true});
async function waitUntil(check:()=>Promise<boolean>,label:string){for(let i=0;i<100;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Timed out: '+label);}
try{
 await staff.goto('http://localhost:5189/login');await staff.getByLabel('Your name',{exact:true}).fill('Browser Owner');await staff.getByLabel('Canteen password',{exact:true}).fill('shanu');await staff.getByRole('button',{name:'Enter dashboard',exact:true}).click();await staff.waitForURL('**/canteen');
 await student.goto('http://localhost:5188/dashboard');await student.getByRole('heading',{name:/Good/}).waitFor();
 const promotion=student.locator('section[aria-label="Promotions and special menus"]');await promotion.locator('article').first().waitFor();assert.equal(await promotion.locator('article').count(),1);
 await promotion.getByRole('button',{name:'Show Sunday Funday',exact:true}).click();await promotion.getByRole('heading',{name:'Sunday Funday',exact:true}).waitFor();
 await student.getByRole('button',{name:'✦ Offers',exact:true}).click();const menu=student.locator('#cafes');await waitUntil(async()=>await menu.locator('article').count()===1,'offers filter');assert.equal(await menu.locator('article').count(),1);assert.match(await menu.innerText(),/120\.00/);
 await student.evaluate(()=>window.scrollTo(0,0));await student.screenshot({path:out+'/student-desktop.png',fullPage:true});
 await menu.getByRole('button',{name:'Add to cart',exact:true}).click();await student.getByRole('link',{name:'Open cart, 1 item',exact:true}).waitFor();assert.equal(await student.getByText(/added to your cart/).count(),0);
 await student.getByRole('link',{name:'Open cart, 1 item',exact:true}).click();await student.getByRole('button',{name:'Place order',exact:true}).click();await student.waitForURL('**/order-success?id=*');
 await waitUntil(async()=>Boolean(await db.order.findFirst({where:{studentId:user.id}})),'browser order');
 assert.equal((await db.order.findFirstOrThrow({where:{studentId:user.id}})).totalPaise,12000);
 await waitUntil(async()=>(await staff.evaluate(()=>(window as any).__orderTones))>=2,'new order audio');
 for(const name of ['Accept order','Start preparing','Mark ready','Collected']){const button=staff.getByRole('button',{name,exact:true});await button.waitFor();await button.click();await new Promise(resolve=>setTimeout(resolve,450));}
 await waitUntil(async()=>(await db.order.findFirstOrThrow({where:{studentId:user.id}})).status==='COLLECTED','collection');
 await student.goto('http://localhost:5188/dashboard');await student.getByRole('button',{name:'Redeem Browser Coffee Combo for 10 tokens',exact:true}).waitFor();await student.getByRole('button',{name:'Redeem Browser Coffee Combo for 10 tokens',exact:true}).click();await student.waitForURL('**/dashboard/orders/*');
 assert.equal(await db.order.count({where:{studentId:user.id,executionMode:'REWARD'}}),1);
 await staff.goto('http://localhost:5189/canteen/rewards');const cost=staff.getByRole('spinbutton',{name:'Token price for Browser Coffee Combo',exact:true});await cost.fill('11');await cost.blur();await waitUntil(async()=>(await db.reward.findUniqueOrThrow({where:{menuItemId:combo.id}})).tokenCost===11,'reward autosave');assert.equal(await staff.getByRole('button',{name:'Save price',exact:true}).count(),0);
 await staff.goto('http://localhost:5189/canteen/offers');await staff.getByRole('button',{name:/Add offer/}).click();await staff.getByLabel(/^Item or combo/).selectOption(tea.id);await staff.getByLabel('Offer name',{exact:true}).fill('Tea browser deal');await staff.getByLabel(/^Discount type/).selectOption('AMOUNT');await staff.getByLabel('Discount (₹)',{exact:true}).fill('5');await staff.getByLabel('Ends · India time',{exact:true}).fill(new Date(Date.now()+86400000+330*60000).toISOString().slice(0,16));await staff.getByRole('button',{name:'Save offer',exact:true}).click();await staff.getByRole('heading',{name:'Tea browser deal',exact:true}).waitFor();
 await staff.screenshot({path:out+'/canteen-offers.png',fullPage:true});
 await staff.goto('http://localhost:5189/canteen/banners');await staff.getByRole('heading',{name:'Manage banners & special menus',exact:true}).waitFor();await staff.locator('article').first().getByRole('button',{name:'Edit & menu',exact:true}).click();await staff.getByRole('heading',{name:'Offers in this promotion',exact:true}).waitFor();
 await staff.screenshot({path:out+'/canteen-banner-editor.png',fullPage:true});
 await student.setViewportSize({width:390,height:844});await student.goto('http://localhost:5188/dashboard');await student.getByRole('heading',{name:/Good/}).waitFor();
 await student.locator('#cafes article').first().waitFor();await student.locator('section[aria-label="Promotions and special menus"] article').first().waitFor();
 assert(await student.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile page must not overflow horizontally');
 await student.screenshot({path:out+'/student-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: browser login, desktop/mobile layout, matching banner menu, offers filter, floating cart, discounted checkout, staff collection, reward redemption, autosave, offer creation and banner editor');
}catch(issue){await student.screenshot({path:out+'/failure-student.png',fullPage:true});await staff.screenshot({path:out+'/failure-canteen.png',fullPage:true});throw issue;}finally{
 await browser.close();app.locals.closeEventStreams();for(const proxy of proxies){proxy.closeAllConnections();await new Promise<void>(resolve=>proxy.close(()=>resolve()));}await new Promise<void>(resolve=>api.close(()=>resolve()));await db.$disconnect();
}
