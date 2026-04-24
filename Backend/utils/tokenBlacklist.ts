import dotenv from 'dotenv';
import path from 'path';
import Redis from 'ioredis';

dotenv.config({ path: path.join(process.cwd(), 'Backend', '.env') });

const redis = new Redis('rediss://default:gQAAAAAAATrxAAIgcDI1ZjAzNmM2OGRiZWE0ZTRhOTIyNzBjZTZiOTI1ZDFjYQ@smashing-scorpion-80625.upstash.io:6379', {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: {},
  maxRetriesPerRequest: 3,
});


redis.on('error', (err: Error) => console.error('❌ Redis blacklist error:', err.message));

const tokenBlacklist = {
  add: async (token: string, ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> => {
    const ttlSeconds = Math.floor(ttlMs / 1000);
    await redis.setex(`blacklist:${token}`, ttlSeconds, '1');
  },

  has: async (token: string): Promise<boolean> => {
    const exists = await redis.exists(`blacklist:${token}`);
    return exists === 1;
  },

  delete: async (token: string): Promise<void> => {
    await redis.del(`blacklist:${token}`);
  },
};

export default tokenBlacklist;