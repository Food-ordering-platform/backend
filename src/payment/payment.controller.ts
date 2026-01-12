import { Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { PrismaClient } from "../../generated/prisma";
import crypto from "crypto";
import { OrderService } from "../order/order.service";

const prisma = new PrismaClient();

export class PaymentController {
  
  // =================================================================
  // 1. Verify Payment (Called by Frontend after redirect)
  // =================================================================
  static async verify(req: Request, res: Response) {
    try {
      const { reference } = req.params;

      // 1. Check if order exists locally
      const order = await prisma.order.findUnique({ where: { reference } });
      if (!order) return res.status(404).json({ error: "Order not found" });

      // 2. Verify with Korapay (Server-to-Server check)
      const charge = await PaymentService.verifyPayment(reference);

      // 3. Handle Logic
      // ✅ FIX: If successful, let OrderService handle EVERYTHING (DB update + emails).
      // We do NOT update the DB here for success, or we trigger the race condition.
      if (charge.status === "success") {
        await OrderService.processSuccessfulPayment(reference);
      } else {
        // If failed/pending, we handle it manually because the Service only handles success.
        const status = charge.status === "failed" ? "FAILED" : "PENDING";
        await prisma.order.update({
          where: { reference },
          data: { paymentStatus: status },
        });
      }

      // 4. Return status to Frontend
      return res.json({ success: charge.status === "success", charge });
    } catch (err: any) {
      console.error("Verify Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // =================================================================
  // 2. Webhook (Called by Korapay in background)
  // =================================================================
  static async webhook(req: Request, res: Response) {
    try {
      const rawBody = req.body;
      if (!rawBody || rawBody.length === 0)
        return res.status(400).json({ error: "Missing raw payload" });

      // 1. Parse Raw Body
      const payloadString = Buffer.from(rawBody).toString("utf-8");
      let parsed;
      try {
        parsed = JSON.parse(payloadString);
      } catch (e) {
        return res.status(400).json({ error: "Invalid JSON payload" });
      }

      const { event, data } = parsed;
      if (!data)
        return res.status(400).json({ error: "Invalid payload structure" });

      // 2. Verify Signature (Security)
      const expectedSignature = crypto
        .createHmac("sha256", process.env.KORAPAY_SECRET_KEY!)
        .update(JSON.stringify(data))
        .digest("hex");
      
      const signature = req.headers["x-korapay-signature"] as string;
      
      if (!signature || signature !== expectedSignature)
        return res.status(403).json({ error: "Unauthorized: missing signature" });

      const { reference } = data;

      // 3. Handle Events
      if (event === "charge.success") {
        // ✅ FIX: Single Source of Truth. 
        // We just tell the service: "Payment is done, do your job."
        await OrderService.processSuccessfulPayment(reference);
      } else if (event === "charge.failed") {
        await prisma.order.update({
          where: { reference },
          data: { paymentStatus: "FAILED" },
        });
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  }
}