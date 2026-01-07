import { Router } from "express";
import { DispatchController } from "./dispatch.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

// Dispatcher (App User) Endpoints
router.get("/dispatch/dashboard", authMiddleware, DispatchController.getDispatcherDashboard);
router.post("/dispatch/accept", authMiddleware, DispatchController.acceptOrder);

// Rider (Web Link) Public Endpoints
router.get("/task/:trackingId", DispatchController.getRiderTask);
router.post("/task/pickup", DispatchController.pickupOrder);     // 👈 Added this
router.post("/task/complete", DispatchController.completeDelivery); // 👈 Added this

export default router;