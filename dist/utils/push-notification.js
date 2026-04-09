"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushToVendor = exports.sendPushToRiders = void 0;
const push_queue_1 = require("../jobs/push.queue");
const sendPushToRiders = async (title, body, data = {}) => {
    try {
        // Fire and forget! The API responds instantly.
        await push_queue_1.riderPushQueue.add('broadcastToRiders', { title, body, data }, {
            removeOnComplete: true,
            attempts: 3, // Automatically retry if Expo is down
            backoff: { type: 'exponential', delay: 1000 }
        });
        console.log(`📥 Push Notification queued for background processing.`);
    }
    catch (error) {
        console.error("❌ Failed to queue push notification:", error);
    }
};
exports.sendPushToRiders = sendPushToRiders;
const sendPushToVendor = async (pushToken, title, body, data = {}) => {
    await push_queue_1.vendorPushQueue.add('direct', { pushToken, title, body, data }, {
        attempts: 5, // Higher priority/retries for vendors
        backoff: { type: 'exponential', delay: 1000 }
    });
};
exports.sendPushToVendor = sendPushToVendor;
//# sourceMappingURL=push-notification.js.map