"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../auth/auth.middleware");
const admin_service_1 = require("./admin.service");
const router = (0, express_1.Router)();
// Middleware to check if user is ADMIN
const adminCheck = (req, res, next) => {
    if (req.user.role !== "ADMIN")
        return res.status(403).json({ message: "Admin only" });
    next();
};
router.get("/withdrawals", auth_middleware_1.authMiddleware, adminCheck, async (req, res) => {
    try {
        const withdrawals = await admin_service_1.AdminService.getPendingWithdrawals();
        res.json({ success: true, data: withdrawals });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post("/withdrawals/:id", auth_middleware_1.authMiddleware, adminCheck, async (req, res) => {
    try {
        const { action } = req.body; // "APPROVE" or "REJECT"
        const result = await admin_service_1.AdminService.processWithdrawal(req.params.id, action);
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=admin.route.js.map