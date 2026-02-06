// // src/utils/push-notification.ts
// import { Expo } from 'expo-server-sdk';
// import { PrismaClient } from '@prisma/client';

// const expo = new Expo();
// const prisma = new PrismaClient();

// export const sendPushToRiders = async (title: string, body: string, data: any = {}) => {
//   try {
//     // 1. Get all riders who have a push token
//     const riders = await prisma.user.findMany({
//       where: {
//         role: 'RIDER',
//         pushToken: { not: null } // Ensure they have a token
//       },
//       select: { pushToken: true }
//     });

//     const messages = [];
//     for (const rider of riders) {
//       if (!rider.pushToken || !Expo.isExpoPushToken(rider.pushToken)) continue;

//       messages.push({
//         to: rider.pushToken,
//         sound: 'default',
//         title,
//         body,
//         data,
//         priority: 'high',
//         channelId: 'delivery-alerts'
//       });
//     }

//     // 2. Send chunks
//     const chunks = expo.chunkPushNotifications(messages as any);
//     for (const chunk of chunks) {
//       try {
//         await expo.sendPushNotificationsAsync(chunk);
//       } catch (error) {
//         console.error('Error sending push chunk', error);
//       }
//     }
//   } catch (error) {
//     console.error("Push Notification Error:", error);
//   }
// };

// src/utils/push-notification.ts
import { Expo } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';

const expo = new Expo();
const prisma = new PrismaClient();

export const sendPushToRiders = async (title: string, body: string, data: any = {}) => {
  console.log("🚀 Starting Push Notification Process...");
  try {
    // 1. Get all riders
    const riders = await prisma.user.findMany({
      where: {
        role: 'RIDER', // <--- CHECK 1: Are you actually a RIDER in the DB?
        pushToken: { not: null }
      },
      select: { id: true, name: true, pushToken: true } // Select name for debugging
    });

    console.log(`📋 Found ${riders.length} riders with tokens.`);

    const messages = [];
    for (const rider of riders) {
      if (!rider.pushToken || !Expo.isExpoPushToken(rider.pushToken)) {
        console.error(`❌ Invalid Token for Rider ${rider.name} (${rider.id}): ${rider.pushToken}`);
        continue;
      }

      messages.push({
        to: rider.pushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'delivery-alerts' // <--- CHECK 2: Matches Frontend?
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
                 console.log(`✅ Sent successfully to ticket ID: ${ticket.id}`);
             }
        });

      } catch (error) {
        console.error('❌ Error sending push chunk', error);
      }
    }
  } catch (error) {
    console.error("❌ Push Notification System Error:", error);
  }
};