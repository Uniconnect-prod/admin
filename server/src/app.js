import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { buildRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Express application factory (the store must already be initialised).
 */
export function createApp({ disableRateLimits = config.isTest } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      // Same-origin / server-to-server requests have no Origin header.
      if (!origin) return callback(null, true);
      if (config.corsOrigins.length === 0) return callback(null, !config.isProduction);
      return callback(null, config.corsOrigins.includes(origin));
    },
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-platform-code', 'x-platform-id', 'x-country'],
    exposedHeaders: ['Content-Disposition', 'X-Export-Rows', 'X-Export-Complete', 'X-Export-Pages', 'X-Export-Reported-Total', 'X-Export-Duplicates-Skipped', 'Retry-After']
  }));
  app.use(express.json({ limit: '1mb' }));

  if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));

  if (!disableRateLimits) {
    app.use('/api', rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1500,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, code: 'RATE_LIMITED', message: 'Too many requests. Please try again shortly.' }
    }));
  }

  app.use('/api', buildRouter({ disableRateLimits }));

  app.get('/', (req, res) => {
    res.json({ name: 'UNI.SOLUTION Multi-Platform Reporting API', version: '3.0.0', status: 'ONLINE', health: '/api/health' });
  });

  app.use((req, res) => {
    res.status(404).json({ success: false, code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` });
  });
  app.use(errorHandler);
  return app;
}
