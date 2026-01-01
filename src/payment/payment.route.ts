import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { authMiddleware } from "../auth/auth.middleware"; // Import
import bodyParser from "body-parser";

const router = Router();

// ✅ PUBLIC: Do NOT add authMiddleware here. 
// Korapay servers do not have your JWT token.
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }), 
  PaymentController.webhook
);

// 🔒 PRIVATE: Only the user who paid should verify
router.get("/verify/:reference", authMiddleware, PaymentController.verify);

export default router;