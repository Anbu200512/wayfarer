import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/respond.js';

const buildLimiter = (options) =>
  rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
    handler: (_req, res) => sendError(res, 429, 'Too many requests. Please slow down and try again shortly.'),
    ...options,
  });

export const apiLimiter = buildLimiter({ windowMs: 15 * 60 * 1000, limit: 600 });

export const authLimiter = buildLimiter({ windowMs: 15 * 60 * 1000, limit: 40 });

// Overpass / Nominatim usage policy: keep external requests polite and predictable.
export const placesLimiter = buildLimiter({ windowMs: 60 * 1000, limit: 20 });

export const recommendationsLimiter = buildLimiter({ windowMs: 60 * 1000, limit: 8 });

export const trainStatusLimiter = buildLimiter({ windowMs: 60 * 1000, limit: 20 });

export default apiLimiter;
