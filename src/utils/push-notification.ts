import { pushQueue } from '../jobs/push.queue';

export const sendPushToRiders = async (title: string, body: string, data: any = {}) => {
  try {
    // Fire and forget! The API responds instantly.
    await pushQueue.add('broadcastToRiders', { title, body, data }, {
      removeOnComplete: true,
      attempts: 3, // Automatically retry if Expo is down
      backoff: { type: 'exponential', delay: 1000 }
    });
    console.log(`📥 Push Notification queued for background processing.`);
  } catch (error) {
    console.error("❌ Failed to queue push notification:", error);
  }
};