import { loadConfig } from './config/env.js';
import { createPrisma } from './lib/prisma.js';
import { createApp } from './app.js';
const config = loadConfig();
const prisma = createPrisma(config);
const app = createApp(config, prisma);
const server = app.listen(config.PORT, () => console.log(JSON.stringify({ event: 'listening', port: config.PORT })));
server.requestTimeout = 15000;
server.headersTimeout = 10000;
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  app.locals.closeEventStreams();
  const deadline = setTimeout(() => process.exit(1), 10000).unref();
  server.close(() => { void prisma.$disconnect().finally(() => { clearTimeout(deadline); }); });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
