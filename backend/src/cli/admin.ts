import { run } from './run.js';
import { prompt, secretPrompt } from './prompt.js';
import { provisionAdmin } from '../services/provision.js';
void run(async db => {
  const email = await prompt('Admin email: ');
  const name = await prompt('Admin name: ');
  const password = await secretPrompt('Password (12–256 characters): ');
  if (password !== await secretPrompt('Confirm password: ')) throw new Error('Passwords differ');
  await provisionAdmin(db, email, name, password);
  console.log('Admin provisioned.');
});
