import { readFile,writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { envText } from './release-env.mjs';

const args=process.argv.slice(2),origins={};
for(let index=0;index<args.length;index+=2){const key={'--student-origin':'FRONTEND_ORIGIN','--canteen-origin':'CANTEEN_ORIGIN'}[args[index]];if(!key||!args[index+1])throw Error('Provide --student-origin and --canteen-origin.');const url=new URL(args[index+1]);if(url.protocol!=='https:'||url.origin!==args[index+1]||url.hostname.endsWith('.invalid'))throw Error('Use actual exact HTTPS origins, without paths or trailing slashes.');origins[key]=url.origin;}
if(!origins.FRONTEND_ORIGIN||!origins.CANTEEN_ORIGIN||origins.FRONTEND_ORIGIN===origins.CANTEEN_ORIGIN)throw Error('Provide two distinct HTTPS origins.');
for(const name of ['api','worker']){
 const path=new URL(`../deploy/.production/${name}.env`,import.meta.url);
 const values=parseEnv(await readFile(path,'utf8'));
 await writeFile(path,'# PRIVATE: import only into the matching Railway service. Never commit or share.\n'+envText({...values,...origins}),{mode:0o600});
}
console.log('Updated student/canteen origins in both private backend configurations. All credentials and secrets were preserved.');
