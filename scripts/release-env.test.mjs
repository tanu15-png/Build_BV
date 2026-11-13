import test from 'node:test';
import assert from 'node:assert/strict';
import { productionFiles,envText } from './release-env.mjs';
import { parseEnv } from 'node:util';

test('release settings separate privileged credentials and preserve the public/private boundary',()=>{
 const source={DATABASE_URL:'postgresql://app:private@db.example/test?sslmode=require',MIGRATION_DATABASE_URL:'postgresql://owner:private@db.example/test?sslmode=require',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};
 const files=productionFiles(source,{studentOrigin:'https://students.example.edu',canteenOrigin:'https://canteen.example.edu'});
 const hosted=productionFiles({...source,DATABASE_URL:'postgresql://app:private@pooler.supabase.com/test'})['api.env'];
 assert.equal(new URL(hosted.DATABASE_URL).searchParams.get('sslrootcert'),'/app/certs/supabase-prod-ca-2021.crt');
 assert.equal(new URL(files['api.env'].DATABASE_URL).searchParams.get('sslmode'),'verify-full');
 assert.equal(source.DATABASE_URL.includes('sslmode=require'),true);
 assert(files['api.env'].MIGRATION_DATABASE_URL);assert(!('MIGRATION_DATABASE_URL' in files['worker.env']));
 assert.equal(files['api.env'].SESSION_SECRET,files['worker.env'].SESSION_SECRET);assert.notEqual(files['api.env'].SESSION_SECRET,files['api.env'].OTP_SECRET);
 assert.notEqual(files['api.env'].SESSION_SECRET,productionFiles(source)['api.env'].SESSION_SECRET);
 for(const name of ['student.env','canteen.env'])assert(!/private|SESSION_SECRET|OTP_SECRET|DATABASE_URL/.test(envText(files[name])));
 assert.equal(files['student.env'].VITE_SUPABASE_URL,source.SUPABASE_URL);assert(!('VITE_SUPABASE_URL' in files['canteen.env']));
 assert.equal(parseEnv(envText(files['student.env'])).API_UPSTREAM,'http://${{api.RAILWAY_PRIVATE_DOMAIN}}:4000');
 assert.throws(()=>productionFiles(source,{studentOrigin:'http://students.example.edu'}));
 assert.throws(()=>productionFiles(source,{studentOrigin:'https://same.example.edu',canteenOrigin:'https://same.example.edu'}));
});
