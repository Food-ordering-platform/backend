// src/utils/push-notification.ts
import { Expo } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';

const expo = new Expo();
const prisma = new PrismaClient();

export const sendPushToRiders = async (title: string, body: string, data: any = {}) => {
  try {
    // 1. Get all riders
    const riders = await prisma.user.findMany({
      where: {
        role: 'RIDER',                 // Must be a rider
        isVerified: true,              // ✅ Only approved riders
        pushToken: { not: null },
        isOnline: true,                // And currently online
      },
      select: { id: true, name: true, pushToken: true } // Select name for debugging
    });

    console.log(`📋 Found ${riders.length} riders with tokens.`);

    const messages = [];
    for (const rider of riders) {
      if (!rider.pushToken || !Expo.isExpoPushToken(rider.pushToken)) {
        continue;
      }

      messages.push({
        to: rider.pushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'chow-nuclear-v1' // <--- CHECK 2: Matches Frontend?
      });
    }

    if (messages.length === 0) {
      console.log("⚠️ No valid messages to send.");
      return;
    }

    // 2. Send chunks and LOG THE RESULT
    const chunks = expo.chunkPushNotifications(messages as any);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        // 🔍 LOG EXPO RESPONSE
        console.log("🎫 Expo Ticket Response:", JSON.stringify(ticketChunk));

        // Check for errors in the tickets
        ticketChunk.forEach((ticket: any) => {
          if (ticket.status === 'error') {
            console.error(`🔴 Expo Error: ${ticket.message} (${ticket.details?.error})`);
            // If error is 'DeviceNotRegistered', the token is dead.
          } else {

          }
        });

      } catch (error) {

      }
    }
  } catch (error) {
    console.error("❌ Push Notification System Error:", error);
  }
};