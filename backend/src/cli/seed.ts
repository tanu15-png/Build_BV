import { run } from './run.js';
import { seed } from '../services/provision.js';
void run(async (db, config) => { await seed(db, config); console.log('Directory seeded. Existing operator data retained.'); });
