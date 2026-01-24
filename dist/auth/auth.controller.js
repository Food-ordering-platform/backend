"use strict";
// food-ordering-platform/backend/backend-main/src/auth/auth.controller.ts
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const auth_validator_1 = require("./auth.validator");
class AuthController {
    // ------------------ REGISTER ------------------
    static async register(req, res) {
        try {
            const data = auth_validator_1.registerSchema.parse(req.body);
            const { user, token } = await auth_service_1.AuthService.registerUser(data.name, data.email, data.password, data.phone, data.role, new Date());
            return res.status(201).json({
                message: "User registered. OTP sent to email",
                user,
                token, // Required for verify-otp page
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // ------------------ LOGIN ------------------
    static async login(req, res) {
        try {
            const data = auth_validator_1.loginSchema.parse(req.body);
            const result = await auth_service_1.AuthService.login(data.email, data.password);
            return res.status(200).json({
                message: "Login successful",
                token: result.token,
                user: result.user,
                requireOtp: result.requireOtp
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // ------------------ GOOGLE LOGIN (STRICT) ------------------
    static async googleLogin(req, res) {
        try {
            // Extract termsAccepted flag (defaults to false if missing)
            const { token, termsAccepted } = req.body;
            if (!token)
                throw new Error("Google token is required");
            const result = await auth_service_1.AuthService.loginWithGoogle(token, !!termsAccepted);
            return res.status(200).json({
                message: "Google login successful",
                token: result.token,
                user: result.user,
            });
        }
        catch (err) {
            // 404 for "User not found" prompts the frontend to redirect to signup
            const status = err.message.includes("Sign Up") ? 404 : 400;
            return res.status(status).json({ error: err.message });
        }
    }
    // ------------------ GET ME ------------------
    static async getMe(req, res) {
        try {
            // Middleware ensures req.user exists from the JWT
            if (!req.user)
                throw new Error("Unauthorized");
            const user = await auth_service_1.AuthService.getMe(req.user.id);
            return res.status(200).json({
                message: "User Verified",
                user,
            });
        }
        catch (err) {
            res.status(401).json({ error: "Unauthorized: " + err.message });
        }
    }
    static async updateProfile(req, res) {
        try {
            if (!req.user)
                throw new Error("Unauthorized");
            const { name, phone, address, latitude, longitude } = req.body;
            const updatedUser = await auth_service_1.AuthService.updateProfile(req.user.id, {
                name,
                phone,
                address,
                latitude: latitude ? parseFloat(latitude) : undefined,
                longitude: longitude ? parseFloat(longitude) : undefined,
            });
            return res.status(200).json({
                success: true,
                message: "Profile updated successfully",
                user: updatedUser
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // ------------------ VERIFY OTP ------------------
    static async verifyOtp(req, res) {
        try {
            const { token, code } = req.body;
            const result = await auth_service_1.AuthService.verifyOtp(token, code);
            return res.status(200).json({
                message: "Account verified successfully",
                token: result.token,
                user: result.user
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // ------------------ LOGOUT ------------------
    static async logout(req, res) {
        return res.status(200).json({ message: "Logged out successfully" });
    }
    // ... (Password reset & Push token methods)
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email)
                throw new Error("Email is required");
            const result = await auth_service_1.AuthService.forgotPassword(email);
            return res.status(200).json({ message: "OTP sent to email", token: result.token });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async verifyResetOtp(req, res) {
        try {
            const { token, code } = req.body;
            const result = await auth_service_1.AuthService.verifyForgotPasswordOtp(token, code);
            return res.status(200).json(result);
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async resetPassword(req, res) {
        try {
            const { token, newPassword, confirmPassword } = req.body;
            if (newPassword !== confirmPassword)
                throw new Error("Passwords do not match");
            const result = await auth_service_1.AuthService.resetPassword(token, newPassword);
            return res.status(200).json({ message: "Password reset successful", result });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    static async updatePushToken(req, res) {
        try {
            const { token } = req.body;
            if (!req.user)
                throw new Error("Unauthorized");
            await auth_service_1.AuthService.updatePushToken(req.user.id, token);
            return res.json({ success: true });
        }
        catch (err) {
            return res.status(500).json({ error: "Failed to update token" });
        }
    }
}
exports.AuthController = AuthController;
_a = AuthController;
//WEB PUSH  NOTIFICATION
AuthController.subscribeWebPush = async (req, res, next) => {
    try {
        const { subscription } = req.body;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        await auth_service_1.AuthService.subscribeWebPush(userId, subscription);
        res.status(200).json({ message: "Web push subscribed successfully" });
    }
    catch (error) {
        next(error);
    }
};
//# sourceMappingURL=auth.controller.js.map