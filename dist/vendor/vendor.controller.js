"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VendorController = void 0;
const vendor_service_1 = require("./vendor.service");
class VendorController {
    // --- EXISTING ROUTES ---
    static async getVendorOrders(req, res) {
        try {
            const { restaurantId } = req.params;
            const orders = await vendor_service_1.VendorService.getVendorOrders(restaurantId);
            return res.status(200).json({ success: true, data: orders });
        }
        catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
    static async getEarnings(req, res) {
        try {
            const userId = req.user.id;
            const data = await vendor_service_1.VendorService.getVendorEarnings(userId);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    static async getTransactions(req, res) {
        try {
            const userId = req.user.id;
            const transactions = await vendor_service_1.VendorService.getTransactions(userId);
            return res.status(200).json({ success: true, data: transactions });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async requestPayout(req, res) {
        try {
            // 1. Get User ID from the Auth Middleware
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Unauthorized: User not found" });
            }
            const { amount, bankDetails } = req.body;
            // 2. Basic payload check before hitting the service
            if (!amount || !bankDetails) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: amount and bankDetails are mandatory."
                });
            }
            // 3. Call the refactored Service
            const result = await vendor_service_1.VendorService.requestPayout(userId, Number(amount), bankDetails);
            // 4. Return 201 Created (The professional standard for new records)
            return res.status(201).json({
                success: true,
                message: "Withdrawal request submitted successfully",
                data: result
            });
        }
        catch (error) {
            // 5. Handle Zod validation errors or business logic errors
            console.error(`[PayoutController] Error: ${error.message}`);
            return res.status(error.message.includes("Insufficient") ? 402 : 400).json({
                success: false,
                message: error.message
            });
        }
    }
    // ==========================================
    // 🚀 NEW ORDER ACTION ROUTES
    // ==========================================
    static async acceptOrder(req, res) {
        try {
            const userId = req.user.id; // Authenticated Vendor ID
            const { id } = req.params; // Order ID
            const updatedOrder = await vendor_service_1.VendorService.acceptOrder(userId, id);
            return res.status(200).json({ success: true, data: updatedOrder });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async requestRider(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const updatedOrder = await vendor_service_1.VendorService.requestRider(userId, id);
            return res.status(200).json({ success: true, data: updatedOrder });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async cancelOrder(req, res) {
        try {
            const userId = req.user.id;
            const { id } = req.params;
            const updatedOrder = await vendor_service_1.VendorService.cancelOrder(userId, id);
            return res.status(200).json({ success: true, data: updatedOrder });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
}
exports.VendorController = VendorController;
//# sourceMappingURL=vendor.controller.js.map