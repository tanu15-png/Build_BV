import { randomBytes } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { run } from './run.js';
import { directory, provisionAdmin, rotateCode, seed } from '../services/provision.js';

// Passwords never travel through command-line arguments or console output.
const credentialPath = '.env.provisioned';
void run(async (db, config) => {
  const [email, name] = process.argv.slice(2);
  if (!email || !name) throw new Error('Usage: npm run provision:initial -- admin@email.example "Admin Name"');
  await seed(db, config);
  const credentials = existsSync(credentialPath) ? parseEnv(readFileSync(credentialPath, 'utf8')) : {};
  if (!existsSync(credentialPath)) {
    const fd = openSync(credentialPath, 'wx', 0o600);
    closeSync(fd);
  }
  function secret(key: string) {
    if (!credentials[key]) credentials[key] = randomBytes(32).toString('base64url');
    // Save before provisioning so an interrupted command cannot lose a new password.
    writeFileSync(credentialPath, '# Private generated credentials. Never commit or share this file.\n' +
      Object.entries(credentials).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join('\n') + '\n', { mode: 0o600 });
    return credentials[key]!;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email: normalizedEmail }, include: { roles: true } });
  if (existing && !existing.roles.some(role => role.role === 'ADMIN')) throw new Error('Existing account is not an admin; explicit role management required');
  if (!existing) {
    if (credentials.ADMIN_EMAIL && credentials.ADMIN_EMAIL !== normalizedEmail) throw new Error('Credential file belongs to another admin');
    credentials.ADMIN_EMAIL = normalizedEmail;
    credentials.ADMIN_NAME = name;
    await provisionAdmin(db, normalizedEmail, name, secret('ADMIN_PASSWORD'));
    console.log('Admin account provisioned.');
  } else console.log('Existing admin account preserved.');
  for (const [slug] of directory) {
    const canteen = await db.canteen.findUniqueOrThrow({ where: { slug } });
    if (await db.canteenAccessCode.count({ where: { canteenId: canteen.id, active: true } })) {
      console.log(`${slug}: existing access code preserved.`);
      continue;
    }
    await rotateCode(db, config, slug, secret(`CANTEEN_CODE_${slug.replaceAll('-', '_').toUpperCase()}`));
    console.log(`${slug}: initial access code provisioned.`);
  }
  console.log(`Retrieve generated credentials privately from backend/${credentialPath}. They are not printed or sent to the frontend.`);
});
