import { Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { PrismaClient } from "../../generated/prisma";
import crypto from "crypto";

const prisma = new PrismaClient();

export class PaymentController {
  // Initialize payment (unchanged)
  static async initialize(req: Request, res: Response) {
    try {
      const { amount, email, name, customerId, restaurantId, items, deliveryAddress } = req.body;

      const order = await prisma.order.create({
        data: {
          customerId,
          restaurantId,
          totalAmount: amount,
          paymentStatus: "PENDING",
          status: "PENDING",
          deliveryAddress,
          items: { create: items },
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

  // Verify payment (unchanged)
  static async verify(req: Request, res: Response) {
    try {
      const { reference } = req.params;
      const charge = await PaymentService.verifyPayment(reference);

      const order = await prisma.order.findUnique({ where: { reference } });
      if (!order) return res.status(404).json({ error: "Order not found" });

      const paymentStatus =
        charge.status === "success"
          ? "PAID"
          : charge.status === "failed"
          ? "FAILED"
          : "PENDING";

      await prisma.order.update({
        where: { reference },
        data: { paymentStatus },
      });

      return res.json({ success: paymentStatus === "PAID", charge });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Secure Webhook endpoint (fixed)
 static async webhook(req: Request, res: Response) {
  try {
    const payload = (req as any).body.toString();
    if (!payload) {
      console.error("rawBody missing!");
      return res.status(400).json({ error: "Missing raw payload" });
    }
    const signature = req.headers["x-korapay-signature"] as string;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.KORAPAY_SECRET!)
      .update(payload)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.warn("Invalid webhook signature");
      return res.status(403).json({ error: "Unauthorized: invalid signature" });
    }

    let parsed;
    try {
      parsed = JSON.parse(payload);
    } catch (e) {
      console.error("JSON parse error:", e);
      return res.status(400).json({ error: "Invalid JSON payload" });
    }

    const { event, data } = parsed;
    const { reference } = data;

    let order;
    try {
      order = await prisma.order.findUnique({ where: { reference } });
      if (!order) return res.status(404).json({ error: "Order not found" });
    } catch (dbErr) {
      console.error("Prisma DB error:", dbErr);
      return res.status(500).json({ error: "Database query failed" });
    }

    if (event === "charge.success") {
      await prisma.order.update({ where: { reference }, data: { paymentStatus: "PAID" } });
    } else if (event === "charge.failed") {
      await prisma.order.update({ where: { reference }, data: { paymentStatus: "FAILED" } });
    }

    console.log("Webhook processed successfully:", reference, event);
    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
}
}
