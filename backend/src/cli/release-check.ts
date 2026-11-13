import { readFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { parseEnv } from 'node:util';
import { loadConfig } from '../config/env.js';
import { createPrisma } from '../lib/prisma.js';

async function main(){
  const path=resolve(process.argv[2]||'../deploy/.production/api.env');
  const values=parseEnv(await readFile(path,'utf8'));
  const issues:string[]=[];
  const report=(message:string)=>{issues.push(message);console.error('NEEDS ACTION: '+message);};
  if(values.APP_ENV!=='production'||values.NODE_ENV!=='production')report('Set APP_ENV and NODE_ENV to production.');
  for(const key of ['FRONTEND_ORIGIN','CANTEEN_ORIGIN'])if(!values[key]||values[key]!.includes('YOUR-')||values[key]!.endsWith('.invalid'))report(`Replace ${key} with the actual Railway HTTPS domain.`);
  let config;
  try{config=loadConfig(values);}catch{report('Production environment validation failed. Check required values, verified TLS, distinct secrets and HTTPS origins.');process.exitCode=1;return;}
  if(!values.MIGRATION_DATABASE_URL)report('Add API-only MIGRATION_DATABASE_URL for the release migration.');
  if(values.MIGRATION_DATABASE_URL===values.DATABASE_URL)report('Use separate migration-owner and restricted application credentials.');
  if(values.TRUST_PROXY_HOPS!=='1')report('The private Railway API must use TRUST_PROXY_HOPS=1 with the supplied frontend proxy.');
  try{
    const worker=parseEnv(await readFile(resolve(dirname(path),'worker.env'),'utf8'));
    for(const key of ['DATABASE_URL','SESSION_SECRET','OTP_SECRET','FRONTEND_ORIGIN','CANTEEN_ORIGIN','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'])if(worker[key]!==values[key])report(`API and worker must share ${key}.`);
    if(worker.MIGRATION_DATABASE_URL)report('Remove migration credentials from worker.env.');
    const student=parseEnv(await readFile(resolve(dirname(path),'student.env'),'utf8'));
    if(student.VITE_SUPABASE_URL!==config.SUPABASE_URL||student.VITE_SUPABASE_PUBLISHABLE_KEY!==config.SUPABASE_PUBLISHABLE_KEY)report('Student build variables must use the API Supabase project.');
    for(const name of ['student.env','canteen.env']){
      const front=parseEnv(await readFile(resolve(dirname(path),name),'utf8'));
      if(front.DATABASE_URL||front.MIGRATION_DATABASE_URL||front.SESSION_SECRET||front.OTP_SECRET)report(`Remove server secrets from ${name}.`);
      if(front.PORT!=='8080'||front.PORTAL!==name.replace('.env',''))report(`Correct PORT and PORTAL in ${name}.`);
      if(front.API_UPSTREAM!=='http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000')report(`Correct the Railway API_UPSTREAM reference in ${name}.`);
    }
  }catch{report('Place all four matching service .env files beside api.env.');}
  const localUrl=new URL(config.DATABASE_URL);
  if(localUrl.searchParams.get('sslrootcert')==='/app/certs/supabase-prod-ca-2021.crt')localUrl.searchParams.set('sslrootcert',resolve('certs/supabase-prod-ca-2021.crt'));
  const db=createPrisma({...config,DATABASE_URL:localUrl.toString()});
  try{
    const [role]=await db.$queryRaw<Array<{rolsuper:boolean;rolbypassrls:boolean;canCreate:boolean}>>`SELECT r.rolsuper,r.rolbypassrls,has_schema_privilege(current_user,'public','CREATE') AS "canCreate" FROM pg_roles r WHERE r.rolname=current_user`;
    if(!role||role.rolsuper||role.rolbypassrls||role.canCreate)report('DATABASE_URL must use a restricted application role without owner/schema privileges.');
    const tables=await db.$queryRaw<Array<{relname:string;rls:boolean;allowed:boolean;owner:boolean}>>`SELECT c.relname,c.relrowsecurity AS rls,pg_get_userbyid(c.relowner)=current_user AS owner,
      has_table_privilege(current_user,c.oid,'SELECT') AND has_table_privilege(current_user,c.oid,'INSERT') AND has_table_privilege(current_user,c.oid,'UPDATE') AND has_table_privilege(current_user,c.oid,'DELETE') AS allowed
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>'_prisma_migrations'`;
    if(tables.length<27||tables.some(table=>!table.rls||!table.allowed||table.owner))report('Apply migrations and application-role grants/RLS for all application tables.');
    else console.log('PASS: database connection with verified TLS and restricted application permissions.');
  }catch(error){const code=(error as {code?:string;cause?:{code?:string}}).cause?.code||(error as {code?:string}).code;report('Database/TLS connection failed'+(code&&/^[A-Z0-9_]{1,40}$/.test(code)?` (${code})`:'')+'. Check the connection and provider CA certificate.');}
  finally{await db.$disconnect();}
  try{
    const response=await fetch(config.SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY!},signal:AbortSignal.timeout(15000),redirect:'error'});
    const auth=await response.json() as {external?:{email?:boolean};mailer_autoconfirm?:boolean;disable_signup?:boolean};
    if(!response.ok||!auth.external?.email||auth.mailer_autoconfirm!==false||auth.disable_signup!==false)report('Enable Supabase email signup and required email confirmation; verify the publishable key.');
    else console.log('PASS: Supabase public Auth configuration; no email was sent.');
  }catch{report('Unable to verify the Supabase public Auth configuration.');}
  if(issues.length){console.error(`${issues.length} release configuration item(s) still need attention. No settings were changed.`);process.exitCode=1;}
  else console.log('PASS: production service configuration. Finish real SMTP inbox delivery and deployed HTTPS acceptance before opening access to students.');
}
void main().catch(()=>{console.error('Release check failed. Prepare the private service configuration files first. Secret values were not printed.');process.exitCode=1;});
