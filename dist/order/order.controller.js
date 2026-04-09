"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const order_service_1 = require("./order.service");
class OrderController {
    // ✅ NEW: Calculate Quote
    static async getQuote(req, res) {
        try {
            const { restaurantId, deliveryLatitude, deliveryLongitude, items } = req.body;
            if (!restaurantId || !deliveryLatitude || !deliveryLongitude || !items) {
                return res.status(400).json({ success: false, message: "Missing location or items for quote" });
            }
            const quote = await order_service_1.OrderService.getOrderQuote(restaurantId, deliveryLatitude, deliveryLongitude, items);
            return res.status(200).json({ success: true, data: quote });
        }
        catch (err) {
            console.error("Quote error", err);
            return res.status(500).json({ success: false, message: err.message });
        }
    }
    // Create a new order AND initialize payment
    static async createOrder(req, res) {
        try {
            const { customerId, restaurantId, deliveryAddress, deliveryPhoneNumber, deliveryNotes, deliveryLatitude, deliveryLongitude, items, name, email, idempotencyKey: bodyKey } = req.body;
            const headerKey = req.headers['idempotency-key'];
            const idempotencyKey = bodyKey || headerKey;
            if (!customerId || !restaurantId || !deliveryAddress || !items || !name || !email) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }
            const { order, checkoutUrl } = await order_service_1.OrderService.createOrderWithPayment(customerId, restaurantId, deliveryAddress, deliveryPhoneNumber, deliveryNotes, deliveryLatitude, deliveryLongitude, items, name, email, idempotencyKey);
            return res.status(201).json({
                success: true,
                data: {
                    orderId: order.id,
                    reference: order.reference,
                    token: order.token,
                    checkoutUrl,
                    amounts: {
                        total: order.totalAmount,
                        delivery: order.deliveryFee,
                    }
                },
            });
        }
        catch (err) {
            console.error("create order error", err);
            return res.status(500).json({ success: false, message: err.message || "Server Error" });
        }
    }
    static async getAllOrders(req, res) {
        try {
            const { customerId } = req.params;
            if (!customerId)
                return res.status(400).json({ success: false, message: "CustomerId is required" });
            const orders = await order_service_1.OrderService.getOrdersByCustomer(customerId);
            return res.status(200).json({ success: true, data: orders });
        }
        catch (err) {
            console.error("Get orders error:", err);
            return res.status(500).json({ success: false, message: err.message || "Server Error" });
        }
    }
    static async getSingleOrder(req, res) {
        try {
            const { reference } = req.params;
            if (!reference) {
                return res.status(400).json({ success: false, message: "Order reference is required" });
            }
            const order = await order_service_1.OrderService.getOrderByReference(reference);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }
            return res.status(200).json({ success: true, data: order });
        }
        catch (err) {
            console.error("Get single order error:", err.message);
            return res.status(500).json({ success: false, message: err.message || "Server Error" });
        }
    }
}
exports.OrderController = OrderController;
//# sourceMappingURL=order.controller.js.map