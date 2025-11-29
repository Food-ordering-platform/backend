"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const auth_validator_1 = require("./auth.validator");
class AuthController {
    // Register a new user (Customer or Vendor)
    static async register(req, res) {
        try {
            const data = auth_validator_1.registerSchema.parse(req.body);
            const { user, token } = await auth_service_1.AuthService.registerUser(data.name, data.email, data.password, data.phone, data.role);
            return res.status(201).json({
                message: "User registered. OTP sent to email",
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    isVerified: user.isVerified,
                },
                token, // frontend uses this for verify-otp flow
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // Login a user
    static async login(req, res) {
        try {
            const data = auth_validator_1.loginSchema.parse(req.body);
            const result = await auth_service_1.AuthService.login(data.email, data.password);
            return res.status(200).json({
                message: "Login successful",
                result,
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // Verify OTP
    static async verifyOtp(req, res) {
        try {
            const { token, code } = req.body;
            const result = await auth_service_1.AuthService.verifyOtp(token, code);
            return res.status(200).json(result);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // Forgot Password (send OTP to email)
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email)
                throw new Error("Email is required");
            const result = await auth_service_1.AuthService.forgotPassword(email);
            return res.status(200).json({
                message: "OTP sent to email for password reset",
                token: result.token, // short-lived JWT for reset flow
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // Verify Reset OTP
    static async verifyResetOtp(req, res) {
        try {
            const { token, code } = req.body;
            if (!token || !code)
                throw new Error("Token and OTP are required");
            const result = await auth_service_1.AuthService.verifyForgotPasswordOtp(token, code);
            return res.status(200).json(result);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // Reset Password
    static async resetPassword(req, res) {
        try {
            const { token, newPassword, confirmPassword } = req.body;
            if (!token || !newPassword) {
                throw new Error("All fields are required");
            }
            if (newPassword !== confirmPassword) {
                throw new Error("Passwords do not match");
            }
            const result = await auth_service_1.AuthService.resetPassword(token, newPassword);
            return res.status(200).json({
                message: "Password reset successful, please login again",
                result,
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map