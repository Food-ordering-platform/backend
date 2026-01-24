"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_middleware_1 = require("./auth.middleware");
const router = (0, express_1.Router)();
// Register
router.post("/register", auth_controller_1.AuthController.register);
// Login
router.post("/login", auth_controller_1.AuthController.login);
router.post("/google", auth_controller_1.AuthController.googleLogin);
//Verify current user
router.get("/me", auth_middleware_1.authMiddleware, auth_controller_1.AuthController.getMe);
//Update profile
router.put("/profile", auth_middleware_1.authMiddleware, auth_controller_1.AuthController.updateProfile);
// Verify registration OTP
router.post("/verify-otp", auth_controller_1.AuthController.verifyOtp);
// Forgot password (send OTP)
router.post("/forgot-password", auth_controller_1.AuthController.forgotPassword);
// Verify OTP for reset password
router.post("/verify-reset-otp", auth_controller_1.AuthController.verifyResetOtp);
// Reset password
router.post("/reset-password", auth_controller_1.AuthController.resetPassword);
//Push Notificatioin
router.post("/push-token", auth_controller_1.AuthController.updatePushToken);
//web push notification
router.post("/web-push/subscribe", auth_middleware_1.authMiddleware, auth_controller_1.AuthController.subscribeWebPush);
exports.default = router;
//# sourceMappingURL=auth.route.js.map