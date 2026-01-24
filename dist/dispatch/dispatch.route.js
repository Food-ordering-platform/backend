"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dispatch_controller_1 = require("./dispatch.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
// Dispatcher (App User) Endpoints
router.get("/dashboard", auth_middleware_1.authMiddleware, dispatch_controller_1.DispatchController.getDispatcherDashboard);
router.post("/accept", auth_middleware_1.authMiddleware, dispatch_controller_1.DispatchController.acceptOrder);
// Add this line to your routes
router.post("/assign-rider", dispatch_controller_1.DispatchController.assignLinkRider);
// Rider (Web Link) Public Endpoints
router.get("/task/:trackingId", dispatch_controller_1.DispatchController.getRiderTask);
router.post("/task/pickup", dispatch_controller_1.DispatchController.pickupOrder); // 👈 Added this
router.post("/task/complete", dispatch_controller_1.DispatchController.completeDelivery); // 👈 Added this
router.get("/wallet", auth_middleware_1.authMiddleware, dispatch_controller_1.DispatchController.getPartnerWallet);
router.post("/wallet/withdraw", auth_middleware_1.authMiddleware, dispatch_controller_1.DispatchController.requestWithdrawal);
exports.default = router;
//# sourceMappingURL=dispatch.route.js.map