"use strict";
// food-ordering-platform/backend/backend-main/src/auth/auth.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const google_auth_library_1 = require("google-auth-library");
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dayjs_1 = __importDefault(require("dayjs"));
const email_service_1 = require("../utils/email/email.service");
const prisma = new client_1.PrismaClient();
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
class AuthService {
    // ------------------ REGISTER ------------------
    // ------------------ REGISTER ------------------
    static async registerUser(name, email, password, phone, role = "CUSTOMER", termsAcceptedAt, address, inviteCode // 🟢 1. ADD THIS OPTIONAL PARAMETER
    ) {
        let logisticsCompanyId = null;
        // 🟢 2. THE FLEET ROUTER: If they are a Rider and provided a code, link them!
        if (role === "RIDER" && inviteCode) {
            // Clean up the code just in case they added spaces
            const cleanCode = inviteCode.trim().toUpperCase();
            const company = await prisma.logisticsCompany.findUnique({
                where: { inviteCode: cleanCode }
            });
            if (!company) {
                throw new Error("Invalid Company Invite Code. Please check with your manager and try again.");
            }
            logisticsCompanyId = company.id;
        }
        // 1. Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            if (!existingUser.isEmailVerified) {
                // If unverified, update details and resend OTP
                const updatedUser = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        termsAcceptedAt: termsAcceptedAt,
                        name: name,
                        phone: phone,
                        address: address,
                        role: role,
                        isOnline: false,
                        logisticsCompanyId: logisticsCompanyId // 🟢 3. Update relation here too
                    }
                });
                const code = await this.generateOtp(updatedUser.id);
                await (0, email_service_1.sendOtPEmail)(updatedUser.email, code);
                return { user: updatedUser };
            }
            throw new Error("This email is already registered. Please login.");
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    phone,
                    role,
                    isEmailVerified: false,
                    isVerified: false,
                    isOnline: false,
                    termsAcceptedAt: termsAcceptedAt,
                    address,
                    logisticsCompanyId: logisticsCompanyId // 🟢 4. Save relation for new users!
                },
            });
            return user;
        });
        const code = await this.generateOtp(result.id);
        (0, email_service_1.sendOtPEmail)(result.email, code).catch(err => console.error("Failed to send OTP email:", err));
        if (result.role === "RIDER") {
            (0, email_service_1.sendRiderVerificationPendingEmail)(result.email, result.name)
                .catch(err => console.error("Failed to send Rider pending email:", err));
        }
        return { user: result };
    }
    // ------------------ LOGIN ------------------
    static async login(email, password) {
        const user = await prisma.user.findUnique({
            where: { email },
            include: { restaurant: true }
        });
        if (!user)
            throw new Error("We couldn't find an account with that email.");
        if (!user.password)
            throw new Error("Invalid credentials. Did you sign up with Google?");
        const isValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isValid)
            throw new Error("Incorrect password. Please try again.");
        if (!user.isEmailVerified) {
            const code = await this.generateOtp(user.id);
            await (0, email_service_1.sendOtPEmail)(user.email, code);
            // Temp token just for the OTP verification screen
            const tempToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "30m" });
            return {
                requireOtp: true,
                accessToken: tempToken, // Renamed to accessToken for frontend consistency
                user
            };
        }
        // 🟢 THE FIX: Generate the Two-Token System
        const { accessToken, refreshToken } = this.generateTokens(user);
        (0, email_service_1.sendLoginAlertEmail)(user.email, user.name);
        // Return both tokens to the controller
        return { accessToken, refreshToken, user };
    }
    // ------------------ GOOGLE LOGIN ------------------
    static async loginWithGoogle(token, termsAccepted) {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
            throw new Error("Unable to verify Google account.");
        }
        const { email, name, sub: googleId, picture } = payload;
        let user = await prisma.user.findUnique({
            where: { email },
        });
        // If user doesn't exist AND they didn't accept terms (via Signup page)
        if (!user && !termsAccepted) {
            throw new Error("Account not found. Please use the Sign Up page to create an account.");
        }
        if (!user) {
            // CREATE NEW USER 
            user = await prisma.user.create({
                data: {
                    email,
                    name: name || "Google User",
                    googleId,
                    avatar: picture,
                    isEmailVerified: true,
                    role: "CUSTOMER",
                    termsAcceptedAt: new Date(),
                },
            });
        }
        else {
            // UPDATE EXISTING USER
            if (!user.googleId) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { googleId, avatar: picture || user.avatar },
                });
            }
        }
        // 🟢 THE FIX: Generate the Two-Token System
        const { accessToken, refreshToken } = this.generateTokens(user);
        if (user.email) {
            (0, email_service_1.sendLoginAlertEmail)(user.email, user.name);
        }
        // Return both tokens to the controller
        return { accessToken, refreshToken, user };
    }
    static async getMe(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isVerified: true,
                latitude: true,
                longitude: true,
                address: true,
                phone: true,
                restaurant: true,
                // 🟢 NEW: Send the logistics config to the mobile app!
                logisticsCompany: {
                    select: {
                        name: true,
                        showEarningsToRiders: true
                    }
                }
            }
        });
        if (!user) {
            throw new Error("User session not found. Please login again.");
        }
        return user;
    }
    static async updateProfile(userId, data) {
        return await prisma.user.update({
            where: { id: userId },
            data: {
                name: data.name,
                phone: data.phone,
                address: data.address,
                latitude: data.latitude,
                longitude: data.longitude,
                pushToken: data.pushToken, // <--- 2. Add Field Here
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                address: true,
                latitude: true,
                longitude: true,
                role: true,
                isVerified: true,
                pushToken: true // Optional: if you want to see it in the response
            }
        });
    }
    // ------------------ OTP UTILS ------------------
    static async verifyOtp(email, code) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
            throw new Error("User not found");
        const otpRecord = await prisma.otp.findFirst({
            where: { userId: user.id, code, used: false, expiresAt: { gt: new Date() } },
        });
        if (!otpRecord)
            throw new Error("Invalid or expired OTP");
        // 
        // 1. Mark Email as Verified (Allows Login)
        // 2. Only Auto-Approve CUSTOMERS. Riders remain Pending.
        const updateData = {
            isEmailVerified: true
        };
        if (user.role === 'CUSTOMER') {
            updateData.isVerified = true; // Auto-verify customers
        }
        // If RIDER, isVerified stays false (Pending Admin)
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
        });
        await prisma.otp.update({ where: { id: otpRecord.id }, data: { used: true } });
        // Return the updated status so frontend knows where to go
        return {
            isVerified: updatedUser.isVerified,
            role: updatedUser.role
        };
    }
    // ------------------ FORGOT PASSWORD ------------------
    static async forgotPassword(email) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new Error("We sent an OTP if this email exists.");
        }
        const code = (0, crypto_1.randomInt)(100000, 999999).toString();
        const expiresAt = (0, dayjs_1.default)().add(30, "minute").toDate();
        await prisma.otp.create({
            data: { code, userId: user.id, expiresAt },
        });
        await (0, email_service_1.sendOtPEmail)(user.email, code);
        const token = jsonwebtoken_1.default.sign({ userId: user.id, purpose: "RESET_PASSWORD" }, process.env.JWT_SECRET, { expiresIn: "24h" });
        return { message: "OTP sent to email", token };
    }
    static async verifyForgotPasswordOtp(token, code) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            if (payload.purpose !== "RESET_PASSWORD")
                throw new Error("Invalid request type");
            const otp = await prisma.otp.findFirst({
                where: { userId: payload.userId, code, used: false, expiresAt: { gt: new Date() } },
            });
            if (!otp)
                throw new Error("Invalid or expired code.");
            await prisma.otp.update({ where: { id: otp.id }, data: { used: true } });
            const resetToken = jsonwebtoken_1.default.sign({ userId: payload.userId, purpose: "RESET_PASSWORD_FINAL" }, process.env.JWT_SECRET, { expiresIn: "30m" });
            return { message: "OTP Verified.", resetToken };
        }
        catch {
            throw new Error("Invalid or expired session.");
        }
    }
    static async resetPassword(resetToken, newPassword) {
        try {
            const payload = jsonwebtoken_1.default.verify(resetToken, process.env.JWT_SECRET);
            if (payload.purpose !== "RESET_PASSWORD_FINAL")
                throw new Error("Invalid request");
            const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
            await prisma.user.update({
                where: { id: payload.userId },
                data: { password: hashedPassword },
            });
            return { message: "Password reset successful" };
        }
        catch {
            throw new Error("Your session expired. Please start the password reset process again.");
        }
    }
    static async updatePushToken(userId, token) {
        return prisma.user.update({
            where: { id: userId },
            data: { pushToken: token }
        });
    }
    static async generateOtp(userId) {
        const code = (0, crypto_1.randomInt)(100000, 999999).toString();
        const expiresAt = (0, dayjs_1.default)().add(30, "minute").toDate();
        await prisma.otp.create({
            data: { code, userId, expiresAt },
        });
        return code;
    }
    static generateTokens(user) {
        const accessToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "15m" } // Short-lived Access Token
        );
        const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, // Make sure you add this to .env!
        { expiresIn: "30d" } // Long-lived Refresh Token
        );
        return { accessToken, refreshToken };
    }
    // ------------------ REFRESH TOKEN ------------------
    static async refreshAccessToken(refreshToken) {
        try {
            // 1. Verify the token signature
            const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            // 2. Ensure the user still exists (and hasn't been deleted)
            const user = await prisma.user.findUnique({
                where: { id: decoded.userId }
            });
            if (!user)
                throw new Error("User not found");
            // 3. Generate a brand new 15-minute Access Token
            const { accessToken } = this.generateTokens({ id: user.id, role: user.role });
            return accessToken;
        }
        catch (error) {
            // If the token is expired or tampered with, it throws here
            throw new Error("Invalid or expired refresh token.");
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map