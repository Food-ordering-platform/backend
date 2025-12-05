import { Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { PrismaClient } from "../../generated/prisma";
import crypto from "crypto";

const prisma = new PrismaClient();

// === PLATFORM SETTING ===
// In the future, this can be a function like `calculateDeliveryFee(distance)`
const PLATFORM_DELIVERY_FEE = 500; 

export class PaymentController {
  static async initialize(req: Request, res: Response) {
    try {
      const { amount, email, name, customerId, restaurantId, items, deliveryAddress } = req.body;

      // 1. Fetch Restaurant (Check exist only, NO fee reading)
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
      });

      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      // 2. Generate References
      const reference = crypto.randomBytes(12).toString("hex");
      const token = crypto.randomBytes(16).toString("hex");

      // 3. Fetch Items for Snapshot
      const menuItemIds = items.map((item: any) => item.menuItemId);
      const dbMenuItems = await prisma.menuItem.findMany({
        where: { id: { in: menuItemIds } },
      });
      const itemsMap = new Map(dbMenuItems.map((item) => [item.id, item]));

      // 4. Create Order
      const order = await prisma.order.create({
        data: {
          customerId,
          restaurantId,
          totalAmount: amount, 
          deliveryFee: PLATFORM_DELIVERY_FEE, 
          reference, 
          paymentStatus: "PENDING",
          status: "PENDING",
          deliveryAddress,
          token,
          items: { 
            create: items.map((item: any) => {
                const originalItem = itemsMap.get(item.menuItemId);
                if (!originalItem) throw new Error(`Menu item ${item.menuItemId} not found`);
                
                return {
                    menuItemId: item.menuItemId,
                    menuItemName: originalItem.name, 
                    quantity: item.quantity,
                    price: item.price
                };
            }) 
          },
        },
        include: { items: true },
      });

      const checkoutUrl = await PaymentService.initiatePayment(
        amount,
        name,
        email,
        order.reference
      );

      return res.json({ checkoutUrl, reference: order.reference, orderId: order.id });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ... (Verify and Webhook methods remain unchanged as they don't touch fees) ...
  static async verify(req: Request, res: Response) {
    try {
      const { reference } = req.params;
      const charge = await PaymentService.verifyPayment(reference);
      const order = await prisma.order.findUnique({ where: { reference } });
      if (!order) return res.status(404).json({ error: "Order not found" });
      const paymentStatus = charge.status === "success" ? "PAID" : charge.status === "failed" ? "FAILED" : "PENDING";
      await prisma.order.update({ where: { reference }, data: { paymentStatus } });
      return res.json({ success: paymentStatus === "PAID", charge });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  static async webhook(req: Request, res: Response) {
    try {
      const rawBody = req.body;
      if (!rawBody || rawBody.length === 0) return res.status(400).json({ error: "Missing raw payload" });
      const payloadString = Buffer.from(rawBody).toString("utf-8");
      let parsed;
      try { parsed = JSON.parse(payloadString); } catch (e) { return res.status(400).json({ error: "Invalid JSON payload" }); }
      const { event, data } = parsed;
      if (!data) return res.status(400).json({ error: "Invalid payload structure" });
      
      const expectedSignature = crypto.createHmac("sha256", process.env.KORAPAY_SECRET_KEY!).update(JSON.stringify(data)).digest("hex");
      const signature = req.headers["x-korapay-signature"] as string;
      if (!signature || signature !== expectedSignature) return res.status(403).json({ error: "Unauthorized: missing signature" });

      const { reference } = data;
      if (event === "charge.success") {
        await prisma.order.update({ where: { reference }, data: { paymentStatus: "PAID" } });
      } else if (event === "charge.failed") {
        await prisma.order.update({ where: { reference }, data: { paymentStatus: "FAILED" } });
      }
      return res.sendStatus(200);
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
}