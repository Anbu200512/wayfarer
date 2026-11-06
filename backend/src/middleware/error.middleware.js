import { ZodError } from 'zod';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { sendError } from '../utils/respond.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/* eslint-disable no-unused-vars */
export const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation failed';
    details = err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
  }

  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Resource not found';
  }

  if (err.code === 'P2002') {
    statusCode = 409;
    const target = err.meta?.target;
    message = `A record with this ${Array.isArray(target) ? target.join(', ') : target || 'value'} already exists`;
  }

  if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Related record does not exist';
  }

  if (statusCode >= 500) {
    logger.error(`${err.name}: ${err.message}`);
    if (!env.isProduction) logger.error(err.stack);
    message = 'Something went wrong on our end. Please try again.';
  }

  return sendError(res, statusCode, message, details);
};
/* eslint-enable no-unused-vars */
