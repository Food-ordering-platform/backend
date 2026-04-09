"use strict";
// food-ordering-platform/backend/backend-main/src/auth/auth.controller.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("./auth.service");
const auth_validator_1 = require("./auth.validator");
class AuthController {
    // ------------------ REGISTER ------------------
    static async register(req, res) {
        try {
            const data = auth_validator_1.registerSchema.parse(req.body);
            const result = await auth_service_1.AuthService.registerUser(data.name, data.email, data.password, data.phone, data.role, new Date(), data.address, data.inviteCode);
            return res.status(201).json({
                message: "User registered. OTP sent to email",
                data: result,
                // Required for verify-otp page
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // ------------------ LOGIN ------------------
    // ------------------ LOGIN ------------------
    static async login(req, res) {
        try {
            const data = auth_validator_1.loginSchema.parse(req.body);
            const result = await auth_service_1.AuthService.login(data.email, data.password);
            // 🟢 The Fix: Set the Refresh Token in an HttpOnly Cookie
            if (result.refreshToken) {
                res.cookie("refreshToken", result.refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // 'none' is crucial for cross-domain staging
                    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
                });
            }
            return res.status(200).json({
                message: "Login successful",
                token: result.accessToken, // Using accessToken from the service
                refreshToken: result.refreshToken,
                user: result.user,
                requireOtp: result.requireOtp,
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
            // 🟢 The Fix: Set the Refresh Token in an HttpOnly Cookie
            if (result.refreshToken) {
                res.cookie("refreshToken", result.refreshToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
                });
            }
            return res.status(200).json({
                message: "Google login successful",
                token: result.accessToken, // Using accessToken from the service
                user: result.user,
                refreshToken: result.refreshToken,
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
    // src/auth/auth.controller.ts
    static async updateProfile(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId)
                return res.status(401).json({ success: false, message: "Unauthorized" });
            // Extract pushToken from body
            const { name, phone, address, latitude, longitude, pushToken } = req.body;
            const updatedUser = await auth_service_1.AuthService.updateProfile(userId, {
                name,
                phone,
                address,
                latitude,
                longitude,
                pushToken // <--- Pass it to service
            });
            return res.status(200).json({ success: true, message: "Profile updated", data: updatedUser });
        }
        catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }
    // ------------------ VERIFY OTP ------------------
    static async verifyOtp(req, res) {
        try {
            const { email, code } = req.body;
            if (!email || !code) {
                throw new Error("Email and OTP code are required");
            }
            const result = await auth_service_1.AuthService.verifyOtp(email, code);
            return res.status(200).json({
                success: true,
                message: "Account verified successfully",
                data: result,
            });
        }
        catch (err) {
            return res.status(400).json({ error: err.message });
        }
    }
    // ------------------ LOGOUT ------------------
    // ------------------ LOGOUT ------------------
    static async logout(req, res) {
        try {
            // Clear the HttpOnly cookie for the Next.js Web App
            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            });
            return res.status(200).json({ message: "Logout successful" });
        }
        catch (error) {
            return res.status(500).json({ error: "Failed to log out" });
        }
    }
    // ... (Password reset & Push token methods)
    static async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email)
                throw new Error("Email is required");
            const result = await auth_service_1.AuthService.forgotPassword(email);
            return res
                .status(200)
                .json({ message: "OTP sent to email", token: result.token });
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
            return res
                .status(200)
                .json({ message: "Password reset successful", result });
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
    // ------------------ REFRESH ENDPOINT ------------------
    static async refreshToken(req, res) {
        try {
            // 1. Extract the token
            const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
            // Log the presence (not the value) of the token for debugging
            console.log(`[Refresh] Token received from ${req.cookies.refreshToken ? 'cookie' : 'body'}:`, !!refreshToken);
            if (!refreshToken) {
                console.warn("[Refresh] Rejecting: No refresh token provided.");
                return res.status(401).json({ error: "Refresh token missing" });
            }
            // 2. Attempt the refresh
            const accessToken = await auth_service_1.AuthService.refreshAccessToken(refreshToken);
            console.log("[Refresh] ✅ Success: New access token generated.");
            return res.status(200).json({ accessToken });
        }
        catch (error) {
            // 🟢 THE CRITICAL LOG: This reveals the "Why" behind the 403
            console.error("[Refresh] ❌ Failed:", error.message);
            // Clear the cookie if it was a browser-based request
            res.clearCookie("refreshToken", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            });
            return res.status(403).json({
                error: error.message || "Session expired. Please log in again."
            });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=auth.controller.js.map