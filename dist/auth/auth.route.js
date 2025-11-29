"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const router = (0, express_1.Router)();
// Register
router.post("/register", auth_controller_1.AuthController.register);
// Login
router.post("/login", auth_controller_1.AuthController.login);
// Verify registration OTP
router.post("/verify-otp", auth_controller_1.AuthController.verifyOtp);
// Forgot password (send OTP)
router.post("/forgot-password", auth_controller_1.AuthController.forgotPassword);
// Verify OTP for reset password
router.post("/verify-reset-otp", auth_controller_1.AuthController.verifyResetOtp);
// Reset password
router.post("/reset-password", auth_controller_1.AuthController.resetPassword);
exports.default = router;
//# sourceMappingURL=auth.route.js.map