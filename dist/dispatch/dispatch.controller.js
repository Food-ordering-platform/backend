"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchController = void 0;
const dispatch_service_1 = require("./dispatch.service");
// 1. Import the schemas
const dispatch_validator_1 = require("./dispatch.validator");
class DispatchController {
    static async getDispatcherDashboard(req, res) {
        try {
            const userId = req.user.id;
            const data = await dispatch_service_1.DispatchService.getDispatcherDashboard(userId);
            return res.status(200).json({ success: true, data });
        }
        catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
    static async acceptOrder(req, res) {
        try {
            const userId = req.user.id;
            // 2. Validate Input
            const { orderId } = dispatch_validator_1.acceptOrderSchema.parse(req.body);
            const order = await dispatch_service_1.DispatchService.acceptOrder(userId, orderId);
            return res.status(200).json({ success: true, message: "Order Accepted", data: order });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message, errors: err.errors });
        }
    }
    static async getRiderTask(req, res) {
        try {
            const { trackingId } = req.params;
            const data = await dispatch_service_1.DispatchService.getRiderTask(trackingId);
            return res.status(200).json({ success: true, data });
        }
        catch (err) {
            return res.status(404).json({ success: false, message: err.message });
        }
    }
    static async pickupOrder(req, res) {
        try {
            // 3. Validate Input
            const { trackingId } = dispatch_validator_1.pickupSchema.parse(req.body);
            const result = await dispatch_service_1.DispatchService.pickupOrder(trackingId);
            return res.status(200).json(result);
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async assignLinkRider(req, res) {
        try {
            // 4. Validate Input
            const { trackingId, name, phone } = dispatch_validator_1.assignRiderSchema.parse(req.body);
            const result = await dispatch_service_1.DispatchService.assignLinkRider(trackingId, name, phone);
            return res.status(200).json(result);
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message, errors: err.errors });
        }
    }
    static async completeDelivery(req, res) {
        try {
            // 5. Validate Input
            const { trackingId, otp } = dispatch_validator_1.completeDeliverySchema.parse(req.body);
            const result = await dispatch_service_1.DispatchService.completeDelivery(trackingId, otp);
            return res.status(200).json(result);
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    static async getPartnerWallet(req, res) {
        try {
            const userId = req.user.id;
            const data = await dispatch_service_1.DispatchService.getPartnerWallet(userId);
            return res.status(200).json({ success: true, data });
        }
        catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
    static async requestWithdrawal(req, res) {
        try {
            const userId = req.user.id;
            // 6. Validate Input (Amount & Bank Details)
            const { amount, bankDetails } = dispatch_validator_1.withdrawalSchema.parse(req.body);
            const result = await dispatch_service_1.DispatchService.requestWithdrawal(userId, amount, bankDetails);
            return res.status(200).json(result);
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message, errors: err.errors });
        }
    }
}
exports.DispatchController = DispatchController;
//# sourceMappingURL=dispatch.controller.js.map