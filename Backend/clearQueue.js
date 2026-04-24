require('dotenv').config({ path: __dirname + '/.env' });
const { Queue } = require('bullmq');

async function clearQueue() {
  const queue = new Queue('rank', {
    connection: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT) || 6379
    }
  });

  await queue.obliterate({ force: true });
  console.log('✅ Queue cleared successfully');
  process.exit(0);
}

clearQueue().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});