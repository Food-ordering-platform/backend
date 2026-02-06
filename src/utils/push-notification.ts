// src/utils/push-notification.ts
import { Expo } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';

const expo = new Expo();
const prisma = new PrismaClient();

export const sendPushToRiders = async (title: string, body: string, data: any = {}) => {
  try {
    // 1. Get all riders who have a push token
    const riders = await prisma.user.findMany({
      where: {
        role: 'RIDER',
        pushToken: { not: null } // Ensure they have a token
      },
      select: { pushToken: true }
    });

    const messages = [];
    for (const rider of riders) {
      if (!rider.pushToken || !Expo.isExpoPushToken(rider.pushToken)) continue;

      messages.push({
        to: rider.pushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'delivery-alerts'
      });
    }

    // 2. Send chunks
    const chunks = expo.chunkPushNotifications(messages as any);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('Error sending push chunk', error);
      }
    }
  } catch (error) {
    console.error("Push Notification Error:", error);
  }
};