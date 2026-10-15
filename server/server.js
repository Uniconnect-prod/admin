import { config } from './src/config/index.js';
import { initStore } from './src/store/index.js';
import { seedReferenceData } from './src/store/seed.js';
import { createApp } from './src/app.js';
import { isVaultConfigured } from './src/integrations/secretVault.js';

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled rejection]', reason);
});

async function start() {
  await initStore();
  await seedReferenceData();

  if (!isVaultConfigured()) {
    console.warn('[Config] INTEGRATION_SECRET_KEY is not set (or not 32 bytes). Platform API credentials cannot be saved or used until it is configured.');
  }
  if (config.outbound.allowPrivateHosts.length) {
    console.warn(`[Config] Private-network outbound exceptions enabled for: ${config.outbound.allowPrivateHosts.join(', ')}`);
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[Server] Reporting API listening on http://localhost:${config.port} (store: ${config.reportingStore})`);
  });
}

start().catch((err) => {
  console.error('[Server] Fatal start-up error:', err);
  process.exit(1);
});
