import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { loadConfig } from '../config/env.js';
async function main() {
  const config = loadConfig();
  assert(config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY, 'Supabase Auth settings missing');
  const frontend = parseEnv(readFileSync('../frontend/.env', 'utf8'));
  assert.equal(frontend.VITE_SUPABASE_URL, config.SUPABASE_URL, 'Frontend and backend must use the same project');
  assert.equal(frontend.VITE_SUPABASE_PUBLISHABLE_KEY, config.SUPABASE_PUBLISHABLE_KEY, 'Publishable keys differ');
  const response = await fetch(`${config.SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: config.SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(15000), redirect: 'error',
  });
  assert.equal(response.status, 200, 'Auth settings endpoint rejected the publishable key');
  const value = await response.json() as { external?: { email?: boolean }; mailer_autoconfirm?: boolean; disable_signup?: boolean };
  assert.equal(value.external?.email, true, 'Enable the Email provider');
  assert.equal(value.mailer_autoconfirm, false, 'Enable Confirm email in Supabase');
  assert.equal(value.disable_signup, false, 'Allow new signups for student and initial staff registration');
  console.log('PASS: frontend/backend project settings match; public Auth API accepts the key; email signup enabled and confirmation required.');
  console.log('SMTP delivery and callback allowlist still require a real browser/email acceptance test. No email was sent.');
}
void main().catch(error => {
  console.error(error instanceof assert.AssertionError ? `Auth check failed: ${error.message}` : 'Auth check failed. Check configuration and connectivity.');
  const code = error?.cause?.code ?? error?.code;
  if (typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code)) console.error(`Error code: ${code}`);
  process.exitCode = 1;
});
