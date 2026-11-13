import assert from 'node:assert/strict';

const base=process.env.CONTAINER_TEST_CANTEEN_URL;assert(base,'Provide the isolated local canteen container URL.');
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Container smoke test is restricted to localhost test fixtures.');
const jar=new Map();
async function request(path,method='GET',body,type='application/json'){
 const response=await fetch(base+'/api/v1/canteen'+path,{method,headers:{Origin:base,Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...(method!=='GET'?{'X-CSRF-Token':jar.get('csrf'),'Content-Type':type}: {})},...(body?{body:type==='application/json'?JSON.stringify(body):body}: {})});
 for(const cookie of response.headers.getSetCookie()){const [k,v]=cookie.split(';')[0].split('=');jar.set(k,v);}
 return response;
}
const csrf=await request('/auth/csrf');assert.equal(csrf.status,200);jar.set('csrf',(await csrf.json()).csrfToken);
const login=await request('/auth/canteen/access','POST',{name:'Container smoke owner',accessCode:'shanu'});assert.equal(login.status,200);assert(login.headers.getSetCookie().some(cookie=>cookie.includes('HttpOnly')));
assert.equal((await request('/auth/me')).status,200);assert.equal((await request('/rewards')).status,200);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=','base64');
const upload=await request('/banners/images','POST',png,'image/png');assert.equal(upload.status,201);const {imageRef}=await upload.json();
const image=await request(imageRef);assert.equal(image.status,200);assert.match(image.headers.get('cache-control'),/immutable/);assert.deepEqual(Buffer.from(await image.arrayBuffer()),png);
const logout=await request('/auth/logout','POST',{});assert.equal(logout.status,200);assert.equal((await request('/auth/me')).status,401);
console.log('PASS: frontend → API container login, HttpOnly cookies, rewards, poster upload/read and logout');
