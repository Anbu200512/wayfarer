import './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { apiLimiter } from './middleware/rateLimit.middleware.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app=express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({origin:env.clientUrl.split(',').map(v=>v.trim()),credentials:true}));
app.use(express.json({limit:'1mb'}));
app.use('/api',apiLimiter,routes);
app.use(notFoundHandler);
app.use(errorHandler);
const server = app.listen(env.port, () => {
  logger.info(`Travel planner API listening on port ${env.port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${env.port} is already in use. Set a different PORT in backend/.env and update VITE_API_URL in frontend/.env.`);
    process.exitCode = 1;
    return;
  }
  logger.error(`Unable to start the API server: ${error.message}`);
  process.exitCode = 1;
});
