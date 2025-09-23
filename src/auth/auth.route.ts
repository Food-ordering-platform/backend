import { Router } from "express";
import { AuthController } from "./auth.controller";

const router = Router();

// Register
router.post("/register", AuthController.register);

// Login
router.post("/login", AuthController.login);

// Verify registration OTP
router.post("/verify-otp", AuthController.verifyOtp);

// Forgot password (send OTP)
router.post("/forgot-password", AuthController.forgotPassword);

// Verify OTP for reset password
router.post("/verify-reset-otp", AuthController.verifyResetOtp);

// Reset password
router.post("/reset-password", AuthController.resetPassword);

export default router;
