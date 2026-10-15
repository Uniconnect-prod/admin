/**
 * Local development mode with an IN-MEMORY reporting store (nothing is written to the real
 * admin database, data is lost on restart).
 *
 *   SEED_SUPER_ADMIN_PASSWORD=<at least 10 chars> npm run dev:memory
 *
 * Also allows the local synthetic mock API (npm run mock:platform-api) on 127.0.0.1:5055.
 */
import crypto from 'node:crypto';

process.env.NODE_ENV = 'development';
process.env.REPORTING_STORE = 'memory';
process.env.OUTBOUND_ALLOW_PRIVATE_HOSTS = process.env.OUTBOUND_ALLOW_PRIVATE_HOSTS || '127.0.0.1:5055';
process.env.OUTBOUND_ALLOW_HTTP_HOSTS = process.env.OUTBOUND_ALLOW_HTTP_HOSTS || '127.0.0.1:5055';
if (!process.env.INTEGRATION_SECRET_KEY) {
  // Secrets live only in memory in this mode, so a per-process key is sufficient.
  process.env.INTEGRATION_SECRET_KEY = crypto.randomBytes(32).toString('base64');
}
if (!process.env.SEED_SUPER_ADMIN_PASSWORD || process.env.SEED_SUPER_ADMIN_PASSWORD.length < 10) {
  console.error('[dev-memory] Set SEED_SUPER_ADMIN_PASSWORD (min 10 chars) to create the local Super Admin.');
  process.exit(1);
}

await import('../server.js');
