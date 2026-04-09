"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("./admin.controller");
const auth_middleware_1 = require("../auth/auth.middleware");
const auth_middleware_2 = require("../auth/auth.middleware");
const router = (0, express_1.Router)();
router.post("/login", admin_controller_1.AdminController.login);
//  RBAC IN ACTION:
// We array both middlewares. First it checks if they are logged in, 
// then it strictly verifies their database role is "ADMIN".
const adminAuth = [auth_middleware_1.authMiddleware, (0, auth_middleware_2.roleMiddleware)(["ADMIN"])];
// --- Analytics ---
router.get("/analytics", adminAuth, admin_controller_1.AdminController.getAnalytics);
router.get("/analytics/chart", adminAuth, admin_controller_1.AdminController.getChartAnalytics);
// --- User Management ---
router.get("/users", adminAuth, admin_controller_1.AdminController.getUsers);
router.patch("/users/:id/approve", adminAuth, admin_controller_1.AdminController.approveUser);
router.delete("/users/:id", adminAuth, admin_controller_1.AdminController.deleteUser);
// --- Payouts ---
router.get("/payouts", adminAuth, admin_controller_1.AdminController.getPayouts);
router.patch("/payouts/:id/pay", adminAuth, admin_controller_1.AdminController.markPayoutPaid);
// --- Logistics Management ---
router.post("/logistics", adminAuth, admin_controller_1.AdminController.createLogisticsCompany);
router.get("/logistics", adminAuth, admin_controller_1.AdminController.getLogisticsCompanies);
// --- Weekly Settlements ---
router.get("/logistics/:companyId/settlement", adminAuth, admin_controller_1.AdminController.downloadCompanySettlement);
router.post("/logistics/:companyId/mark-paid", adminAuth, admin_controller_1.AdminController.markCompanyPaid);
exports.default = router;
//# sourceMappingURL=admin.route.js.map