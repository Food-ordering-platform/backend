import { Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { PrismaClient } from "@prisma/client";
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

      // 2. Verify with paystack (Server-to-Server check)
      const transactionData = await PaymentService.verifyPayment(reference);

      // 3. Handle Logic
      // ✅ FIX: If successful, let OrderService handle EVERYTHING (DB update + emails).
      // We do NOT update the DB here for success, or we trigger the race condition.
      if (transactionData.status === "success") {
        await OrderService.processSuccessfulPayment(reference);
      } else {
        // If failed/pending, we handle it manually because the Service only handles success.
        const status =
          transactionData.status === "failed" ? "FAILED" : "PENDING";
        await prisma.order.update({
          where: { reference },
          data: { paymentStatus: status },
        });
      }

      // 4. Return status to Frontend
      return res.json({
        success: transactionData.status === "success",
        transactionData,
      });
    } catch (err: any) {
      console.error("Verify Error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // =================================================================
  // 2. Webhook (Called by Paystack in background)
  // =================================================================
  static async webhook(req: Request, res: Response) {
    try {
      const signature = req.headers["x-paystack-signature"] as string;
      const secret = process.env.PAYSTACK_SECRET_KEY!;

      // 1. Get the Raw Body captured by app.ts
      // We cast to 'any' because rawBody is a custom property we added
      const rawBody = (req as any).rawBody;

      if (!rawBody || !signature) {
        return res.status(400).json({ error: "Missing signature or body" });
      }

      // 2. Verify Signature using the RAW BUFFER (Most secure method)
      const hash = crypto
        .createHmac("sha512", secret)
        .update(rawBody)
        .digest("hex");

      if (hash !== signature) {
        return res
          .status(403)
          .json({ error: "Unauthorized: invalid signature" });
      }

      // 3. Parse the event (Now we can safely use req.body because express.json() ran)
      const { event, data } = req.body;

      // Handle successful charge
      if (event === "charge.success") {
        await OrderService.processSuccessfulPayment(data.reference);
      } else if (event === "charge.failed") {
        await prisma.order.update({
          where: { reference: data.reference },
          data: { paymentStatus: "FAILED" },
        });
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("Webhook error:", err);
      return res.sendStatus(200);
    }
  }

  static async getBanks(req: Request, res: Response) {
    try {
      const banks = await PaymentService.getBankList();
      return res.status(200).json({ success: true, data: banks });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Failed to fetch banks" });
    }
  }
}
