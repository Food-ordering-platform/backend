import Redis from 'ioredis';

// Connects to your remote Redis instance (e.g., Upstash, Render, AWS)
export const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null, // Required by BullMQ
});

redisClient.on('connect', () => console.log('🟢 Redis Connected'));
redisClient.on('error', (err) => console.error('🔴 Redis Error:', err));