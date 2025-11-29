"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentController = void 0;
const payment_service_1 = require("./payment.service");
const prisma_1 = require("../../generated/prisma");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new prisma_1.PrismaClient();
class PaymentController {
    // Initialize payment (unchanged)
    static async initialize(req, res) {
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
            const checkoutUrl = await payment_service_1.PaymentService.initiatePayment(amount, name, email, order.reference);
            return res.json({ checkoutUrl, reference: order.reference, orderId: order.id });
        }
        catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }
    // Verify payment (unchanged)
    static async verify(req, res) {
        try {
            const { reference } = req.params;
            const charge = await payment_service_1.PaymentService.verifyPayment(reference);
            const order = await prisma.order.findUnique({ where: { reference } });
            if (!order)
                return res.status(404).json({ error: "Order not found" });
            const paymentStatus = charge.status === "success"
                ? "PAID"
                : charge.status === "failed"
                    ? "FAILED"
                    : "PENDING";
            await prisma.order.update({
                where: { reference },
                data: { paymentStatus },
            });
            return res.json({ success: paymentStatus === "PAID", charge });
        }
        catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }
    // Secure Webhook endpoint (fixed)
    static async webhook(req, res) {
        try {
            const rawBody = req.body; // Should be Buffer from bodyParser.raw()
            if (!rawBody || rawBody.length === 0) {
                console.error("rawBody missing!", { body: req.body, headers: req.headers });
                return res.status(400).json({ error: "Missing raw payload" });
            }
            const payloadString = Buffer.from(rawBody).toString("utf-8");
            console.log("Received payloadString:", payloadString);
            let parsed;
            try {
                parsed = JSON.parse(payloadString);
            }
            catch (e) {
                console.error("JSON parse error:", e, { payload: payloadString });
                return res.status(400).json({ error: "Invalid JSON payload" });
            }
            const { event, data } = parsed;
            if (!data) {
                console.error("Missing data in payload", { parsed });
                return res.status(400).json({ error: "Invalid payload structure" });
            }
            const expectedSignature = crypto_1.default
                .createHmac("sha256", process.env.KORAPAY_SECRET_KEY)
                .update(JSON.stringify(data))
                .digest("hex");
            const signature = req.headers["x-korapay-signature"];
            if (!signature) {
                console.warn("Missing signature header", { headers: req.headers });
                return res.status(403).json({ error: "Unauthorized: missing signature" });
            }
            if (signature !== expectedSignature) {
                console.warn("Invalid webhook signature", { received: signature, expected: expectedSignature });
                return res.status(403).json({ error: "Unauthorized: invalid signature" });
            }
            const { reference } = data;
            let order;
            try {
                order = await prisma.order.findUnique({ where: { reference } });
                if (!order)
                    return res.status(404).json({ error: "Order not found" });
            }
            catch (dbErr) {
                console.error("Prisma DB error:", dbErr);
                return res.status(500).json({ error: "Database query failed" });
            }
            if (event === "charge.success") {
                await prisma.order.update({ where: { reference }, data: { paymentStatus: "PAID" } });
            }
            else if (event === "charge.failed") {
                await prisma.order.update({ where: { reference }, data: { paymentStatus: "FAILED" } });
            }
            console.log("Webhook processed successfully:", reference, event);
            return res.sendStatus(200);
        }
        catch (err) {
            console.error("Webhook error:", err);
            return res.status(500).json({ error: "Webhook processing failed" });
        }
    }
}
exports.PaymentController = PaymentController;
//# sourceMappingURL=payment.controller.js.map