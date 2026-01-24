"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const notification_service_1 = require("./notification.service");
class NotificationController {
    static async subscribe(req, res) {
        try {
            // 🟢 CHANGE: Get userId from body instead of req.user
            const { subscription, userId } = req.body;
            if (!userId || !subscription) {
                return res.status(400).json({ success: false, message: "Missing userId or subscription" });
            }
            await notification_service_1.NotificationService.subscribe(userId, subscription);
            return res.status(201).json({ success: true, message: "Subscribed successfully" });
        }
        catch (err) {
            console.error("Subscribe Error:", err);
            return res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.NotificationController = NotificationController;
//# sourceMappingURL=notification.controller.js.map