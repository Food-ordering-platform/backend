"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.vendorPushQueue = exports.riderPushQueue = void 0;
const bullmq_1 = require("bullmq");
const redis_1 = require("../config/redis");
const expo_server_sdk_1 = require("expo-server-sdk");
const client_1 = require("@prisma/client");
const expo = new expo_server_sdk_1.Expo();
const prisma = new client_1.PrismaClient();
// --- 1. THE QUEUES ---
exports.riderPushQueue = new bullmq_1.Queue('riderPushQueue', { connection: redis_1.redisClient });
exports.vendorPushQueue = new bullmq_1.Queue('vendorPushQueue', { connection: redis_1.redisClient });
// --- 2. RIDER WORKER (Broadcasts to many) ---
new bullmq_1.Worker('riderPushQueue', async (job) => {
    const { title, body, data } = job.data;
    const riders = await prisma.user.findMany({
        where: { role: 'RIDER', isVerified: true, isOnline: true, pushToken: { not: null } },
        select: { pushToken: true }
    });
    const messages = riders
        .filter(r => expo_server_sdk_1.Expo.isExpoPushToken(r.pushToken))
        .map(r => ({
        to: r.pushToken,
        sound: 'default',
        title, body, data,
        priority: 'high',
        channelId: 'chow-nuclear-v1'
    }));
    if (messages.length === 0)
        return;
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks)
        await expo.sendPushNotificationsAsync(chunk);
}, { connection: redis_1.redisClient });
// --- 3. VENDOR WORKER (Direct to one owner) ---
new bullmq_1.Worker('vendorPushQueue', async (job) => {
    const { title, body, data, pushToken } = job.data;
    if (!pushToken || !expo_server_sdk_1.Expo.isExpoPushToken(pushToken))
        return;
    const message = {
        to: pushToken,
        sound: 'default', // Use custom sound if you have one
        title, body, data,
        priority: 'high',
        channelId: 'chow-nuclear-v1'
    };
    await expo.sendPushNotificationsAsync([message]);
}, { connection: redis_1.redisClient });
//# sourceMappingURL=push.queue.js.map