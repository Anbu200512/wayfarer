import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const createPrismaClient = () =>
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['warn', 'error'],
  });

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.__prisma ?? createPrismaClient();

if (!env.isProduction) {
  globalForPrisma.__prisma = prisma;
}

export default prisma;
