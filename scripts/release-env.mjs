import { randomBytes } from 'node:crypto';

export function productionFiles(source,{studentOrigin='https://your-student-domain.invalid',canteenOrigin='https://your-canteen-domain.invalid'}={}){
  for(const value of [studentOrigin,canteenOrigin])if(!value.startsWith('https://')||new URL(value).origin!==value)throw Error('Use exact HTTPS origins without a path or trailing slash.');
  if(studentOrigin===canteenOrigin)throw Error('Student and canteen need different HTTPS origins.');
  const tls=value=>{if(!value)return '';const url=new URL(value);if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('Expected a PostgreSQL database URL.');url.searchParams.set('sslmode','verify-full');if(/\.supabase\.(com|co)$/.test(url.hostname))url.searchParams.set('sslrootcert','/app/certs/supabase-prod-ca-2021.crt');return url.toString();};
  const common={NODE_ENV:'production',APP_ENV:'production',DATABASE_URL:tls(source.DATABASE_URL),SUPABASE_URL:source.SUPABASE_URL||'',SUPABASE_PUBLISHABLE_KEY:source.SUPABASE_PUBLISHABLE_KEY||'',FRONTEND_ORIGIN:studentOrigin,CANTEEN_ORIGIN:canteenOrigin,SESSION_SECRET:randomBytes(32).toString('base64url'),OTP_SECRET:randomBytes(32).toString('base64url'),EMAIL_PROVIDER:'supabase',ORDER_MODE:'TEST',SEED_DEVELOPMENT_DATA:'false',EMAIL_VERIFICATION_BYPASS:'false',DB_POOL_MAX:'5',DB_TIMEOUT_MS:'10000',CANTEEN_ACCESS_PASSWORD:source.CANTEEN_ACCESS_PASSWORD||'shanu'};
  const frontend={PORT:'8080',API_UPSTREAM:'http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000'};
  return {
    'api.env':{...common,PORT:'4000',TRUST_PROXY_HOPS:'1',MIGRATION_DATABASE_URL:tls(source.MIGRATION_DATABASE_URL)},
    'worker.env':{...common},
    'student.env':{...frontend,PORTAL:'student',VITE_SUPABASE_URL:common.SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:common.SUPABASE_PUBLISHABLE_KEY},
    'canteen.env':{...frontend,PORTAL:'canteen'},
  };
}
export const envText=values=>Object.entries(values).map(([name,value])=>`${name}=${JSON.stringify(value)}`).join('\n')+'\n';
