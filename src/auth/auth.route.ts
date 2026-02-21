import { Router } from "express";
import { AuthController } from "./auth.controller";
import { authMiddleware } from "./auth.middleware";

const router = Router();

// Register
router.post("/register", AuthController.register);

// Login
router.post("/login", AuthController.login);

router.post("/google", AuthController.googleLogin);

//Verify current user
router.get("/me", authMiddleware, AuthController.getMe)


//Update profile
router.patch("/profile", authMiddleware, AuthController.updateProfile);

// Verify registration OTP
router.post("/verify-otp", AuthController.verifyOtp);

// Forgot password (send OTP)
router.post("/forgot-password", AuthController.forgotPassword);

// Verify OTP for reset password
router.post("/verify-reset-otp", AuthController.verifyResetOtp);

// Reset password
router.post("/reset-password", AuthController.resetPassword);

//Push Notificatioin
router.post("/push-token", AuthController.updatePushToken); 



export default router;
