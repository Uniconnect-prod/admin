import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './src/config/index.js';
import apiRoutes from './src/routes/index.js';
import { connectMongo } from './src/config/mongo.js';

const app = express();

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]:', reason);
});

// Security Headers
app.use(helmet());

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow local development and requests with no origin
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-platform-code', 'x-platform-id']
}));

// Body Parsers & Cookies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api', apiLimiter);

// Register API Routes
app.use('/api', apiRoutes);

// Root Welcome Endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Multi-Platform Report Management System API (MongoDB Live Reporting)',
    version: '2.0.0',
    status: 'ONLINE',
    docs: '/api/health'
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found.` });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Exception]:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
async function startServer() {
  try {
    // Connect to Dual MongoDB (Read-Only Source + Reporting Admin)
    await connectMongo();

    app.listen(config.port, () => {
      console.log(`🚀 [Server] Enterprise Reporting Engine running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('Fatal Server Init Error:', err);
    console.log('[Server] Retrying startServer in 5 seconds...');
    setTimeout(startServer, 5000);
  }
}

startServer();
