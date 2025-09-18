import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { captureRawBody } from "../middlewares/rawBodyMiddleware";
import express from "express"

const router = Router();

// Webhook for Korapay (uses raw body for signature verification)
router.post(
  "/webhook",
  express.json({ verify: captureRawBody }),
  PaymentController.webhook
);

// Optional: verify payment manually
router.get("/verify/:reference", PaymentController.verify);

export default router;
