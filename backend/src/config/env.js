import dotenv from 'dotenv';

dotenv.config();

const required = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long in production.');
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: Number(process.env.PORT || 5002),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5174',
  databaseUrl: process.env.DATABASE_URL,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  overpassUrl: process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter',
  nominatimUrl: process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org',
  geoapifyApiKey: process.env.GEOAPIFY_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  groqBaseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  railwayEngineApiKey: process.env.RAILWAY_ENGINE_API_KEY || '',
};
