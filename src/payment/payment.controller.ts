import { Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { OrderService } from "../order/order.service";

const prisma = new PrismaClient();

function sortKeysDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(obj[key]);
        return acc;
      }, {} as any);
  }
  return obj;
}

export class PaymentController {
  // =================================================================
  // 1. Verify Payment (Called by Frontend after redirect)
  // =================================================================
  // static async verify(req: Request, res: Response) {
  //   try {
  //     const { reference } = req.params;

  //     // 1. Check if order exists locally
  //     const order = await prisma.order.findUnique({ where: { reference } });
  //     if (!order) return res.status(404).json({ error: "Order not found" });

  //     // 2. Verify with paystack (Server-to-Server check)
  //     const transactionData = await PaymentService.verifyPayment(reference);

  //     // 3. Handle Logic
  //     // ✅ FIX: If successful, let OrderService handle EVERYTHING (DB update + emails).
  //     // We do NOT update the DB here for success, or we trigger the race condition.
  //     if (transactionData.status === "success") {
  //       await OrderService.processSuccessfulPayment(reference);
  //     } else {
  //       // If failed/pending, we handle it manually because the Service only handles success.
  //       const status =
  //         transactionData.status === "failed" ? "FAILED" : "PENDING";
  //       await prisma.order.update({
  //         where: { reference },
  //         data: { paymentStatus: status },
  //       });
  //     }

  //     // 4. Return status to Frontend
  //     return res.json({
  //       success: transactionData.status === "success",
  //       transactionData,
  //     });
  //   } catch (err: any) {
  //     console.error("Verify Error:", err);
  //     return res.status(500).json({ error: err.message });
  //   }
  // }

  // =================================================================
  // 2. Webhook (Called by Paystack in background)
  // =================================================================
  // static async webhook(req: Request, res: Response) {
  //   try {
  //     const signature = req.headers["x-paystack-signature"] as string;
  //     const secret = process.env.PAYSTACK_SECRET_KEY!;

  //     // 1. Get the Raw Body captured by app.ts
  //     // We cast to 'any' because rawBody is a custom property we added
  //     const rawBody = (req as any).rawBody;

  //     if (!rawBody || !signature) {
  //       return res.status(400).json({ error: "Missing signature or body" });
  //     }

  //     // 2. Verify Signature using the RAW BUFFER (Most secure method)
  //     const hash = crypto
  //       .createHmac("sha512", secret)
  //       .update(rawBody)
  //       .digest("hex");

  //     if (hash !== signature) {
  //       return res
  //         .status(403)
  //         .json({ error: "Unauthorized: invalid signature" });
  //     }

  //     // 3. Parse the event (Now we can safely use req.body because express.json() ran)
  //     const { event, data } = req.body;

  //     // Handle successful charge
  //     if (event === "charge.success") {
  //       await OrderService.processSuccessfulPayment(data.reference);
  //     } else if (event === "charge.failed") {
  //       await prisma.order.update({
  //         where: { reference: data.reference },
  //         data: { paymentStatus: "FAILED" },
  //       });
  //     }

  //     return res.sendStatus(200);
  //   } catch (err) {
  //     console.error("Webhook error:", err);
  //     return res.sendStatus(200);
  //   }
  // }

static async webhook(req: Request, res: Response) {
  try {
    const signature = (req.headers["x-aggregator-signature"] || req.headers["x-xoropay-signature"]) as string;
    const fullSecret = process.env.XOROPAY_SECRET_KEY || "";
    
    // We break down the key to test all of XoroPay's possible hashing secrets
    const segments = fullSecret.split("_");
    const secretSegment2 = segments[2]; // 318ad...
    const secretFull = fullSecret;      // aggsk_test_...
    const secretEnd = segments.slice(2).join("_"); // 318ad..._agg-589de

    const rawBody = (req as any).rawBody;

    if (!rawBody || !signature) {
      return res.status(401).json({ error: "Missing signature or body" });
    }

    // Two possible ways XoroPay might be stringifying the payload
    const bodyObj = JSON.parse(rawBody.toString());
    const sortedMessage = JSON.stringify(sortKeysDeep(bodyObj));
    const rawMessage = rawBody.toString();

    // Helper to generate the hashes
    const generateHash = (secret: string, payload: string) => 
      crypto.createHmac("sha256", secret).update(payload).digest("hex");

    console.log("=== HASH BRUTE FORCE START ===");
    console.log("🎯 TARGET FROM XOROPAY:", signature);
    console.log("--------------------------------------------------");
    console.log("1. Sorted Payload + Seg 2 Secret:", generateHash(secretSegment2, sortedMessage));
    console.log("2. Raw Payload    + Seg 2 Secret:", generateHash(secretSegment2, rawMessage));
    console.log("3. Sorted Payload + Full Secret :", generateHash(secretFull, sortedMessage));
    console.log("4. Raw Payload    + Full Secret :", generateHash(secretFull, rawMessage));
    console.log("5. Sorted Payload + Seg 2_3 Sec :", generateHash(secretEnd, sortedMessage));
    console.log("6. Raw Payload    + Seg 2_3 Sec :", generateHash(secretEnd, rawMessage));
    console.log("=== HASH BRUTE FORCE END ===");

    // Temporary bypass just so you can see the terminal output without crashing
    // Remove this bypass once you find the matching hash!
    return res.status(200).json({ status: "Debugging Hash" });

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
