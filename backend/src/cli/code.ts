import { run } from './run.js';
import { prompt, secretPrompt } from './prompt.js';
import { rotateCode } from '../services/provision.js';
void run(async (db, config) => {
  const slug = (await prompt('Canteen slug: ')).trim();
  const code = await secretPrompt('New access code (12–256 characters): ');
  if (code !== await secretPrompt('Confirm code: ')) throw new Error('Codes differ');
  const version = await rotateCode(db, config, slug, code);
  console.log(`Access code rotated to version ${version}.`);
});
