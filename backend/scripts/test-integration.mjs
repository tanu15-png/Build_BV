import { Pool } from 'pg';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';

// Never point integration fixtures at a shared/staging/production database.
const raw=process.env.INTEGRATION_DATABASE_URL;
if(!raw)throw Error('Set INTEGRATION_DATABASE_URL to a dedicated localhost PostgreSQL test database.');
const url=new URL(raw);
if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!url.pathname.includes('test')||raw===process.env.DATABASE_URL)throw Error('Refusing a non-local or non-test database.');
const pool=new Pool({connectionString:raw,max:1});
const suites={database:'TEST_DATABASE_URL',auth:'AUTH_TEST_DATABASE_URL',canteenAccess:'CANTEEN_ACCESS_TEST_DATABASE_URL',catalog:'CATALOG_TEST_DATABASE_URL',orders:'ORDER_TEST_DATABASE_URL',pickup:'PICKUP_TEST_DATABASE_URL',notifications:'NOTIFICATION_TEST_DATABASE_URL',commerce:'COMMERCE_TEST_DATABASE_URL'};
const suffix=randomBytes(6).toString('hex'),created=[],env={...process.env};
try{
  for(const [suite,key] of Object.entries(suites)){
    const name=`spoonate_test_${suite.toLowerCase()}_${suffix}`;
    if(!/^spoonate_test_[a-z]+_[a-f0-9]{12}$/.test(name))throw Error('Invalid test database name.');
    await pool.query(`CREATE DATABASE "${name}"`);created.push(name);
    const target=new URL(raw);target.pathname='/'+name;env[key]=target.toString();
  }
  const files=(await readdir('tests/integration')).filter(name=>name.endsWith('.test.ts')).map(name=>'tests/integration/'+name);
  const child=spawn(process.execPath,['--import','tsx','--test',...files],{stdio:'inherit',env});
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
  process.exitCode=code===0?0:1;
}finally{
  for(const name of created)await pool.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await pool.end();
}
