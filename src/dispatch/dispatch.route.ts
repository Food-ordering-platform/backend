import { Router } from "express";
import { DispatchController } from "./dispatch.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

// Dispatcher (App User) Endpoints
router.get("/dashboard", authMiddleware, DispatchController.getDispatcherDashboard);
router.post("/accept", authMiddleware, DispatchController.acceptOrder);
// Add this line to your routes
router.post("/assign-rider", DispatchController.assignLinkRider);

// Rider (Web Link) Public Endpoints
router.get("/task/:trackingId", DispatchController.getRiderTask);
router.post("/task/pickup", DispatchController.pickupOrder);     // 👈 Added this
router.post("/task/complete", DispatchController.completeDelivery); // 👈 Added this

export default router;