"use strict";
// food-ordering-platform/backend/backend-main/src/auth/auth.service.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const prisma_1 = require("../../generated/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const google_auth_library_1 = require("google-auth-library");
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dayjs_1 = __importDefault(require("dayjs"));
const mailer_1 = require("../utils/mailer");
const prisma = new prisma_1.PrismaClient();
const googleClient = new google_auth_library_1.OAuth2Client(process.env.GOOGLE_CLIENT_ID);
class AuthService {
    // ------------------ REGISTER ------------------
    static async registerUser(name, email, password, phone, role = "CUSTOMER", termsAcceptedAt, address) {
        // 1. Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            if (!existingUser.isVerified) {
                // If unverified, update details and resend OTP
                const updatedUser = await prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        termsAcceptedAt: termsAcceptedAt,
                        name: name,
                        phone: phone,
                        address: address,
                        role: role // Update role in case they changed it
                    }
                });
                const code = await this.generateOtp(updatedUser.id);
                await (0, mailer_1.sendOtPEmail)(updatedUser.email, code);
                const token = jsonwebtoken_1.default.sign({ userId: updatedUser.id, role: updatedUser.role }, process.env.JWT_SECRET, { expiresIn: "30m" });
                return { user: updatedUser, token };
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
                    isVerified: false,
                    termsAcceptedAt: termsAcceptedAt,
                    address
                },
            });
            if (role === "DISPATCHER") {
                await tx.logisticsPartner.create({
                    data: {
                        name: `${name}'s Logistics`,
                        email: email,
                        phone: phone,
                        address: address || "Update Your Office Address",
                        ownerId: user.id
                    }
                });
            }
            return user;
        });
        const code = await this.generateOtp(result.id);
        const token = jsonwebtoken_1.default.sign({ userId: result.id, role: result.role }, process.env.JWT_SECRET, { expiresIn: "30m" });
        (0, mailer_1.sendOtPEmail)(result.email, code).catch(err => console.error("Failed to send OTP email:", err));
        return { user: result, token };
    }
    // ------------------ LOGIN ------------------
    static async login(email, password) {
        const user = await prisma.user.findUnique({ where: { email }, include: { restaurant: true } });
        if (!user)
            throw new Error("We couldn't find an account with that email.");
        if (!user.password)
            throw new Error("Invalid credentials. Did you sign up with Google?");
        const isValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isValid)
            throw new Error("Incorrect password. Please try again.");
        if (!user.isVerified) {
            const code = await this.generateOtp(user.id);
            await (0, mailer_1.sendOtPEmail)(user.email, code);
            const tempToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "30m" });
            return {
                requireOtp: true,
                token: tempToken,
                user
            };
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
        (0, mailer_1.sendLoginAlertEmail)(user.email, user.name);
        return { token, user };
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
        // 🛑 BLOCKER: If user doesn't exist AND they didn't accept terms (via Signup page)
        if (!user && !termsAccepted) {
            throw new Error("Account not found. Please use the Sign Up page to create an account.");
        }
        if (!user) {
            // ✅ CREATE NEW USER (With Terms Date)
            user = await prisma.user.create({
                data: {
                    email,
                    name: name || "Google User",
                    googleId,
                    avatar: picture,
                    isVerified: true,
                    role: "CUSTOMER",
                    termsAcceptedAt: new Date(), // <--- SAVING THE DATE
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
        const jwtToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
        if (user.email) {
            (0, mailer_1.sendLoginAlertEmail)(user.email, user.name);
        }
        return { token: jwtToken, user };
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
                address: true, // Make sure address is returned
                phone: true,
                restaurant: true
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
                isVerified: true
            }
        });
    }
    // ------------------ OTP UTILS ------------------
    static async generateOtp(userId) {
        const code = (0, crypto_1.randomInt)(100000, 999999).toString();
        const expiresAt = (0, dayjs_1.default)().add(30, "minute").toDate();
        await prisma.otp.create({
            data: { code, userId, expiresAt },
        });
        return code;
    }
    static async verifyOtp(token, code) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const otp = await prisma.otp.findFirst({
                where: {
                    userId: payload.userId,
                    code,
                    used: false,
                    expiresAt: { gt: new Date() },
                },
            });
            if (!otp)
                throw new Error("The code you entered is invalid or has expired.");
            await prisma.otp.update({
                where: { id: otp.id },
                data: { used: true },
            });
            const user = await prisma.user.update({
                where: { id: payload.userId },
                data: { isVerified: true },
            });
            const sessionToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "24h" });
            return {
                message: "Account Verified Successfully",
                user: { id: user.id, email: user.email, role: user.role },
                token: sessionToken,
            };
        }
        catch (error) {
            if (error.message === "The code you entered is invalid or has expired.") {
                throw error;
            }
            throw new Error("Your session has expired. Please login again to get a new code.");
        }
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
        await (0, mailer_1.sendOtPEmail)(user.email, code);
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
    static async subscribeWebPush(userId, subscription) {
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            throw new Error("Invalid subscription data");
        }
        return await prisma.webPushSubscription.upsert({
            where: { endpoint: subscription.endpoint },
            update: {
                userId,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
            create: {
                userId,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
            },
        });
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map