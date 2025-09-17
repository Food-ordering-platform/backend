import { Router } from "express";
import { PaymentController } from "./payment.controller";

const router = Router();

// Webhook for Korapay
router.post("/webhook", PaymentController.webhook);

// Optional: verify manually
router.get("/verify/:reference", PaymentController.verify);

export default router;
