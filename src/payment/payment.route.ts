import { Router } from "express";
import { PaymentController } from "./payment.controller";
import bodyParser from "body-parser";

const router = Router();

// Webhook route with raw body parser
router.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }), // Matches Korapay's content-type
  PaymentController.webhook
);

router.get("/verify/:reference", PaymentController.verify);

export default router;