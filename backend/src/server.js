import './config/env.js';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { env } from './config/env.js';
import prisma from './config/prisma.js';
import { logger } from './utils/logger.js';

const app = express();

app.disable('x-powered-by');

// Required when running behind a reverse proxy (Render, Railway, Fly, Nginx, ...)
// so rate limiting and client IP detection work correctly.
if (env.isProduction) app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

const allowedOrigins = (env.clientUrl || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (!env.isProduction || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api', apiLimiter, routes);

// Serve the built React app when it is available (single-container deployment).
const staticDir = path.resolve(process.env.STATIC_DIR || path.join(process.cwd(), '..', 'frontend', 'dist'));
const indexFile = path.join(staticDir, 'index.html');
const hasFrontendBuild = fs.existsSync(indexFile);

if (hasFrontendBuild) {
  app.use(
    express.static(staticDir, {
      maxAge: env.isProduction ? '1y' : 0,
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }),
  );

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    return res.sendFile(indexFile);
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(env.port, () => {
  logger.info(`Travel planner listening on port ${env.port} (${env.nodeEnv})`);
  if (hasFrontendBuild) logger.info(`Serving frontend build from ${staticDir}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${env.port} is already in use. Set a different PORT in backend/.env.`);
    process.exitCode = 1;
    return;
  }
  logger.error(`Unable to start the API server: ${error.message}`);
  process.exitCode = 1;
});

const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully.`);
  server.close(async () => {
    try {
      await prisma.$disconnect();
    } catch (error) {
      logger.error(`Error disconnecting Prisma: ${error.message}`);
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.stack : reason}`);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.stack || error.message}`);
  process.exitCode = 1;
});

export default app;
