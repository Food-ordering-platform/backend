"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWebPushNotification = void 0;
// src/utils/web-push.ts
const web_push_1 = __importDefault(require("web-push"));
const prisma_1 = __importDefault(require("./prisma"));
// Initialize VAPID details
web_push_1.default.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
const sendWebPushNotification = async (userId, payload) => {
    try {
        // 1. Get all subscriptions for this user
        const subscriptions = await prisma_1.default.webPushSubscription.findMany({
            where: { userId }
        });
        const notificationPayload = JSON.stringify({
            title: payload.title || "New Notification",
            body: payload.body || "You have a new update.",
            url: payload.data?.url || "/",
            ...payload
        });
        // 2. Send to all devices
        const promises = subscriptions.map((sub) => {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };
            return web_push_1.default.sendNotification(pushSubscription, notificationPayload)
                .catch(async (err) => {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    // Subscription is invalid/expired, remove it
                    console.log('Removing expired subscription:', sub.endpoint);
                    await prisma_1.default.webPushSubscription.delete({ where: { id: sub.id } });
                }
                else {
                    console.error('Web Push Error:', err);
                }
            });
        });
        await Promise.all(promises);
    }
    catch (error) {
        console.error("Error sending web push:", error);
    }
};
exports.sendWebPushNotification = sendWebPushNotification;
//# sourceMappingURL=web-push.js.map