import { Queue } from 'bullmq';
import dotenv from 'dotenv';
import Redis from 'ioredis';
import path from 'path';

dotenv.config();

const redisConnection = new Redis('rediss://default:gQAAAAAAATrxAAIgcDI1ZjAzNmM2OGRiZWE0ZTRhOTIyNzBjZTZiOTI1ZDFjYQ@smashing-scorpion-80625.upstash.io:6379', {
  maxRetriesPerRequest: null,
});

const rankingQueue = new Queue('rank', {
  connection: redisConnection,
});

export default rankingQueue;