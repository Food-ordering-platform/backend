import { Request, Response } from "express";
import { PaymentService } from "./payment.service";
import { PrismaClient } from "../../generated/prisma";
import crypto from "crypto";

const prisma = new PrismaClient();

export class PaymentController {
  // ✅ REMOVED: 'initialize' method (Moved logic to OrderController)

  // Verify Payment (Called by Frontend after redirect)
  static async verify(req: Request, res: Response) {
    try {
      const { reference } = req.params;
      const charge = await PaymentService.verifyPayment(reference);
      
      const order = await prisma.order.findUnique({ where: { reference } });
      if (!order) return res.status(404).json({ error: "Order not found" });

      const paymentStatus = 
        charge.status === "success" ? "PAID" : 
        charge.status === "failed" ? "FAILED" : 
        "PENDING";

      await prisma.order.update({ where: { reference }, data: { paymentStatus } });
      
      return res.json({ success: paymentStatus === "PAID", charge });
    } catch (err: any) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Webhook (Called by Korapay in background)
  static async webhook(req: Request, res: Response) {
    try {
      const rawBody = req.body;
      if (!rawBody || rawBody.length === 0) return res.status(400).json({ error: "Missing raw payload" });
      
      const payloadString = Buffer.from(rawBody).toString("utf-8");
      let parsed;
      try { parsed = JSON.parse(payloadString); } catch (e) { return res.status(400).json({ error: "Invalid JSON payload" }); }
      
      const { event, data } = parsed;
      if (!data) return res.status(400).json({ error: "Invalid payload structure" });
      
      // Verify Signature
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