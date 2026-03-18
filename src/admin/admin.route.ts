import { Router } from "express";
import { AdminController } from "./admin.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { roleMiddleware } from "../auth/auth.middleware";

const router = Router();
router.post("/login", AdminController.login);
//  RBAC IN ACTION:
// We array both middlewares. First it checks if they are logged in, 
// then it strictly verifies their database role is "ADMIN".
const adminAuth = [authMiddleware, roleMiddleware(["ADMIN"])];

// --- Analytics ---
router.get("/analytics", adminAuth, AdminController.getAnalytics);

// --- User Management ---
router.get("/users", adminAuth, AdminController.getUsers);
router.patch("/users/:id/approve", adminAuth, AdminController.approveUser);
router.delete("/users/:id", adminAuth, AdminController.deleteUser);

// --- Payouts ---
router.get("/payouts", adminAuth, AdminController.getPayouts);
router.patch("/payouts/:id/pay", adminAuth, AdminController.markPayoutPaid);

export default router;