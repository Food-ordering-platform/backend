import { Queue, Worker } from 'bullmq';
import { redisClient } from '../config/redis';
import { Expo } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';

const expo = new Expo();
const prisma = new PrismaClient();

// 1. Create the Queue
export const pushQueue = new Queue('pushNotificationQueue', { connection: redisClient as any });

// 2. Create the Background Worker
const pushWorker = new Worker('pushNotificationQueue', async (job) => {
  const { title, body, data } = job.data;
  
  // This heavy DB query and API call now runs in the background
  const riders = await prisma.user.findMany({
    where: { role: 'RIDER', isVerified: true, isOnline: true, pushToken: { not: null } },
    select: { pushToken: true }
  });

  const messages = riders
    .filter(r => Expo.isExpoPushToken(r.pushToken))
    .map(r => ({
      to: r.pushToken!,
      sound: 'default' as const,
      title,
      body,
      data,
      priority: 'high' as const,
      channelId: 'chow-nuclear-v1'
    }));

  if (messages.length === 0) return;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}, { connection: redisClient as any });

pushWorker.on('completed', job => console.log(`✅ Push Job ${job.id} completed`));
pushWorker.on('failed', (job, err) => console.error(`❌ Push Job failed`, err));