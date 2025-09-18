import { Router } from "express";
import { PaymentController } from "./payment.controller";
import { captureRawBody } from "../middlewares/rawBodyMiddleware";
import bodyParser from "body-parser";

const router = Router();

// Use bodyParser.raw specifically for webhook
router.post(
  "/webhook",
  bodyParser.raw({ type: '*/*' }), // <- Accept all content types
  PaymentController.webhook
);

router.get("/verify/:reference", PaymentController.verify);

export default router;
