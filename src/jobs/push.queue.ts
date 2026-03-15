import { Queue, Worker } from 'bullmq';
import { redisClient } from '../config/redis';
import { Expo } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';

const expo = new Expo();
const prisma = new PrismaClient();

// --- 1. THE QUEUES ---
export const riderPushQueue = new Queue('riderPushQueue', { connection: redisClient as any });
export const vendorPushQueue = new Queue('vendorPushQueue', { connection: redisClient as any });

// --- 2. RIDER WORKER (Broadcasts to many) ---
new Worker('riderPushQueue', async (job) => {
  const { title, body, data } = job.data;
  const riders = await prisma.user.findMany({
    where: { role: 'RIDER', isVerified: true, isOnline: true, pushToken: { not: null } },
    select: { pushToken: true }
  });

  const messages = riders
    .filter(r => Expo.isExpoPushToken(r.pushToken))
    .map(r => ({
      to: r.pushToken!,
      sound: 'default' as const,
      title, body, data,
      priority: 'high' as const,
      channelId: 'chow-nuclear-v1'
    }));

  if (messages.length === 0) return;
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) await expo.sendPushNotificationsAsync(chunk);
}, { connection: redisClient as any });

// --- 3. VENDOR WORKER (Direct to one owner) ---
new Worker('vendorPushQueue', async (job) => {
  const { title, body, data, pushToken } = job.data;
  
  if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

  const message = {
    to: pushToken,
    sound: 'default' as const, // Use custom sound if you have one
    title, body, data,
    priority: 'high' as const,
    channelId: 'chow-nuclear-v1'
  };

  await expo.sendPushNotificationsAsync([message]);
}, { connection: redisClient as any });