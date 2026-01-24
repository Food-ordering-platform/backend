import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class NotificationService {
  
  static async subscribe(userId: string, subscription: any) {
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