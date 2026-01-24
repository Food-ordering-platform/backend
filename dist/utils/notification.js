"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = void 0;
const expo_server_sdk_1 = require("expo-server-sdk");
const expo = new expo_server_sdk_1.Expo();
const sendPushNotification = async (pushToken, title, body, data = {}) => {
    if (!expo_server_sdk_1.Expo.isExpoPushToken(pushToken)) {
        console.error(`Push Token${pushToken} is not a valid Expo push Token`);
        return;
    }
    const messages = [{
            to: pushToken,
            sound: 'default',
            title: title,
            body: body,
            data: data,
            priority: 'high', // Critical for waking up Android devices
            channelId: 'orders' // Matches the channel we will create on Frontend
        }];
    try {
        const chunks = expo.chunkPushNotifications(messages);
        for (let chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
        }
        console.log("✅ Push Sent to:", pushToken);
    }
    catch (err) {
        console.error("❌ Push Error:", err);
    }
};
exports.sendPushNotification = sendPushNotification;
//# sourceMappingURL=notification.js.map