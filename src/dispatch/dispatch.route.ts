import { Router } from "express";
import { DispatchController } from "./dispatch.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();

// Rider Endpoints
router.post("/rider/accept", authMiddleware, DispatchController.acceptOrder);

// Manager Endpoints
router.get("/dashboard", authMiddleware, DispatchController.getDispatcherDashboard);

export default router;