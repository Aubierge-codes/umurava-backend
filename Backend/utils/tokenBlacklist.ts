
import Redis from 'ioredis';



// Fixed:
const redis = new Redis({
  host: process.env.REDIS_HOST as string,
  port: parseInt(process.env.REDIS_PORT as string),
  password: process.env.REDIS_PASSWORD as string,
  tls: {},    // required for Upstash (rediss://)
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  lazyConnect: true,
});

redis.on('error', (err: Error) => console.error('❌ Redis blacklist error:', err.message));

const tokenBlacklist = {
  add: async (token: string, ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> => {
    try {
      const ttlSeconds = Math.floor(ttlMs / 1000);
      await redis.setex(`blacklist:${token}`, ttlSeconds, '1');
    } catch {
      console.warn('⚠️ Redis blacklist add failed — skipping');
    }
  },

  has: async (token: string): Promise<boolean> => {
    try {
      const exists = await redis.exists(`blacklist:${token}`);
      return exists === 1;
    } catch {
      console.warn('⚠️ Redis blacklist check failed — allowing request');
      return false;
    }
  },

  delete: async (token: string): Promise<void> => {
    try {
      await redis.del(`blacklist:${token}`);
    } catch {
      console.warn('⚠️ Redis blacklist delete failed — skipping');
    }
  },
};

export default tokenBlacklist;