import { readFile,writeFile,mkdir,access } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { productionFiles,envText } from './release-env.mjs';

const root=new URL('../',import.meta.url),directory=new URL('deploy/.production/',root);
const args=process.argv.slice(2),options={};
for(let index=0;index<args.length;index+=2){const key={'--student-origin':'studentOrigin','--canteen-origin':'canteenOrigin'}[args[index]];if(!key||!args[index+1])throw Error('Use --student-origin HTTPS_ORIGIN and --canteen-origin HTTPS_ORIGIN.');options[key]=args[index+1];}
const names=['api.env','worker.env','student.env','canteen.env'];
for(const name of names){try{await access(new URL(name,directory));throw Error('Production files already exist. Edit them privately; this command never overwrites existing secrets.');}catch(error){if(error.code!=='ENOENT')throw error;}}
const source=parseEnv(await readFile(new URL('backend/.env',root),'utf8'));
const files=productionFiles(source,options);
await mkdir(directory,{recursive:true,mode:0o700});
for(const [name,values] of Object.entries(files))await writeFile(new URL(name,directory),'# PRIVATE: import only into the matching Railway service. Never commit or share.\n'+envText(values),{flag:'wx',mode:0o600});
console.log('Created private service configurations in deploy/.production/. Secret values were not printed.');
console.log('Fresh session/OTP secrets are shared only by API and worker. Migration credentials are API-only.');
console.log('Replace the two your-…-domain.invalid origins in api.env and worker.env after Railway generates your domains.');
console.log('Run npm --prefix backend run release:check before deploying.');
