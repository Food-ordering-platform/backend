import { Router } from "express";
import { AuthController } from "./auth.controller";

const router = Router();

//POST request /api/auth/register => calls authcontroller.register
router.post("/register", AuthController.register)

//POST request /api/auth/login => calls authcontroller.login
router.post("/login", AuthController.login)
router.post("/verify-otp", AuthController.verifyOtp)

export default router