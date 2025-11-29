"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const order_service_1 = require("./order.service");
class OrderController {
    // Create a new order AND initialize payment
    static async createOrder(req, res) {
        try {
            const { customerId, restaurantId, totalAmount, deliveryAddress, items, name, email } = req.body;
            // Validate required fields
            if (!customerId || !restaurantId || !totalAmount || !deliveryAddress || !items || !name || !email) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }
            // Create order and initialize payment
            const { order, checkoutUrl } = await order_service_1.OrderService.createOrderWithPayment(customerId, restaurantId, totalAmount, deliveryAddress, items, name, email);
            return res.status(201).json({
                success: true,
                data: {
                    orderId: order.id,
                    reference: order.reference,
                    //Temporal code
                    token: order.token,
                    checkoutUrl,
                },
            });
        }
        catch (err) {
            console.error("create order error", err);
            return res.status(500).json({ success: false, message: err.message || "Server Error" });
        }
    }
    // Get all orders from a customer
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
    // Get a single order by reference
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
    //Temporal Code
    // Get order by token (for restaurant dashboard and customer tracking)
    static async getOrderByToken(req, res) {
        try {
            const { token } = req.params;
            if (!token) {
                return res.status(400).json({ success: false, message: "Order token is required" });
            }
            const order = await order_service_1.OrderService.getOrderByToken(token);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }
            return res.status(200).json({ success: true, data: order });
        }
        catch (err) {
            console.error("Get order by token error:", err.message);
            return res.status(500).json({ success: false, message: err.message || "Server Error" });
        }
    }
    //Temporal Code
    // Update order status by token (for restaurant dashboard)
    static async updateOrderStatusByToken(req, res) {
        try {
            const { token } = req.params;
            const { status } = req.body;
            if (!token) {
                return res.status(400).json({ success: false, message: "Order token is required" });
            }
            if (!status) {
                return res.status(400).json({ success: false, message: "Status is required" });
            }
            // Validate status
            const validStatuses = ["PENDING", "CONFIRMED", "PREPARING", "ON_THE_WAY", "DELIVERED", "CANCELLED"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
                });
            }
            const order = await order_service_1.OrderService.updateOrderStatusByToken(token, status);
            return res.status(200).json({ success: true, data: order });
        }
        catch (err) {
            console.error("Update order status error:", err.message);
            return res.status(500).json({ success: false, message: err.message || "Server Error" });
        }
    }
}
exports.OrderController = OrderController;
//# sourceMappingURL=order.controller.js.map