import { Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { PaymentStatus, PrismaClient } from "@prisma/client";
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
        const amountPaidInKobo = transactionData.amount;
        await OrderService.processSuccessfulPayment(reference, amountPaidInKobo);
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
        await OrderService.processSuccessfulPayment(data.reference, data.amount);
      } else if (event === "charge.failed") {
        await prisma.order.update({
          where: { reference: data.reference },
          data: { paymentStatus: PaymentStatus.FAILED },
        });
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error("Webhook error:", err);
      return res.sendStatus(200);
    }
  }

// static async webhook(req: Request, res: Response) {
//   try {
//     // 1. Get the signature and the secret
//     const signature = (req.headers["x-aggregator-signature"] || req.headers["x-xoropay-signature"]) as string;
//     const fullSecret = process.env.XOROPAY_SECRET_KEY!;
    
//     // Extract the exact segment XoroPay uses (Index 2)
//     const webhookSecret = fullSecret.split("_")[2]; 
//     const rawBody = (req as any).rawBody;

//     if (!rawBody || !signature) {
//       return res.status(400).json({ error: "Missing signature or body" });
//     }

//     // 2. Hash the RAW payload directly (The #2 Brute Force Winner)
//     const rawMessage = rawBody.toString();
//     const expected = crypto
//       .createHmac("sha256", webhookSecret)
//       .update(rawMessage)
//       .digest("hex");

//     // 3. Timing-safe comparison
//     const isVerified = crypto.timingSafeEqual(
//       Buffer.from(expected),
//       Buffer.from(signature)
//     );

//     if (!isVerified) {
//       console.error("❌ Unauthorized Webhook Attempt");
//       return res.status(401).json({ error: "Invalid signature" });
//     }

//     // 4. Process the verified event safely
//     const eventBody = JSON.parse(rawMessage);
//     const { event, reference } = eventBody;

//     if (event === "charge.success") {
//       console.log(`✅ Payment Confirmed for Order: ${reference}`);
//       // Triggers the push notifications and flips order to PAID
//       await OrderService.processSuccessfulPayment(reference);
//     } else if (event === "charge.failed") {
//       await prisma.order.update({
//         where: { reference: reference },
//         data: { paymentStatus: "FAILED" },
//       });
//     }

//     // Always return 200 OK so XoroPay knows we received it
//     return res.status(200).json({ status: "ok" });

//   } catch (err) {
//     console.error("Webhook processing error:", err);
//     // Return 200 even on internal errors to prevent infinite aggregator retries
//     return res.sendStatus(200);
//   }
// }

  static async getBanks(req: Request, res: Response) {
    try {
      const banks = await PaymentService.getBankList();
      return res.status(200).json({ success: true, data: banks });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: "Failed to fetch banks" });
    }
  }
}
