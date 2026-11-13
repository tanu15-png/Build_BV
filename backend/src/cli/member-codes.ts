import { canteenPassword } from '../config/canteen.js';
import { run } from './run.js';
import { directory, rotateCode } from '../services/provision.js';
import { verifySecret } from '../services/hash.js';

void run(async (db, config) => {
  for (const [slug, name] of directory) {
    const canteen = await db.canteen.findUniqueOrThrow({ where: { slug } });
    const current = await db.canteenAccessCode.findFirst({ where: { canteenId: canteen.id, active: true } });
    if (!current || !await verifySecret(canteenPassword, current.codeHash)) await rotateCode(db, config, slug, canteenPassword);
    console.log(`${name}: access code provisioned`);
  }
});
