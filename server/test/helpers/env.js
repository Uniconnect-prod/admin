// Imported FIRST by every test file so configuration is evaluated with test settings
// (dotenv never overrides variables that are already set, so server/.env values are ignored here).
process.env.NODE_ENV = 'test';
process.env.REPORTING_STORE = 'memory';
process.env.JWT_SECRET = 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.OUTBOUND_ALLOWED_HOSTS = '';
process.env.OUTBOUND_ALLOW_PRIVATE_HOSTS = '';
process.env.OUTBOUND_ALLOW_HTTP_HOSTS = '';
process.env.OUTBOUND_CACHE_TTL_MS = '0';
process.env.SEED_SUPER_ADMIN_PASSWORD = '';
