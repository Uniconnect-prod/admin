import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: 5002, // Explicitly set to 5002 to avoid terminal env var conflicts
  jwtSecret: process.env.JWT_SECRET || 'super-secret-telecom-jwt-enterprise-key-9988',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'super-refresh-token-secret-telecom-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Live Source Database (STRICTLY READ-ONLY)
  sourceMongoUri: process.env.SOURCE_MONGODB_URI || '',

  // Reporting Admin Database (Auth, Admin Users, Roles, Platform Access, Audit Logs)
  reportingMongoUri: process.env.REPORTING_MONGODB_URI || '',
};
