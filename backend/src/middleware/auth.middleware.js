import prisma from '../config/prisma.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { extractBearerToken, verifyToken } from '../utils/jwt.js';

export const protect = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw ApiError.unauthorized('Authentication required. Please log in.');
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw ApiError.unauthorized('Session is invalid or has expired. Please log in again.');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, bio: true, homeLocation: true, createdAt: true },
  });

  if (!user) {
    throw ApiError.unauthorized('Account no longer exists.');
  }

  req.user = user;
  return next();
});

export default protect;
