import { riderPushQueue, vendorPushQueue } from '../jobs/push.queue';

export const sendPushToRiders = async (title: string, body: string, data: any = {}) => {
  try {
    // Fire and forget! The API responds instantly.
    await riderPushQueue.add('broadcastToRiders', { title, body, data }, {
      removeOnComplete: true,
      attempts: 3, // Automatically retry if Expo is down
      backoff: { type: 'exponential', delay: 1000 }
    });
    console.log(`📥 Push Notification queued for background processing.`);
  } catch (error) {
    console.error("❌ Failed to queue push notification:", error);
  }
};

export const sendPushToVendor = async (pushToken: string, title: string, body: string, data: any = {}) => {
  await vendorPushQueue.add('direct', { pushToken, title, body, data }, {
    attempts: 5, // Higher priority/retries for vendors
    backoff: { type: 'exponential', delay: 1000 }
  });
};