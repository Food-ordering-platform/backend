// src/utils/web-push.ts
import webpush from 'web-push';
import prisma from './prisma';

// Initialize VAPID details
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export const sendWebPushNotification = async (userId: string, payload: any) => {
  try {
    // 1. Get all subscriptions for this user
    const subscriptions = await prisma.webPushSubscription.findMany({
      where: { userId }
    });

    const notificationPayload = JSON.stringify({
      title: payload.title || "New Notification",
      body: payload.body || "You have a new update.",
      url: payload.data?.url || "/",
      ...payload
    });

    // 2. Send to all devices
    const promises = subscriptions.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      return webpush.sendNotification(pushSubscription, notificationPayload)
        .catch(async (err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription is invalid/expired, remove it
            console.log('Removing expired subscription:', sub.endpoint);
            await prisma.webPushSubscription.delete({ where: { id: sub.id } });
          } else {
            console.error('Web Push Error:', err);
          }
        });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error("Error sending web push:", error);
  }
};