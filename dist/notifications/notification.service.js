"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
class NotificationService {
    static async subscribe(userId, subscription) {
        const { endpoint, keys } = subscription;
        if (!endpoint || !keys) {
            throw new Error("Invalid subscription payload");
        }
        // Upsert ensuring we update keys if the endpoint already exists
        return await prisma.webPushSubscription.upsert({
            where: { endpoint },
            update: {
                userId,
                p256dh: keys.p256dh,
                auth: keys.auth,
            },
            create: {
                userId,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
            },
        });
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=notification.service.js.map