"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
// src/services/auth.service.ts
const prisma_1 = require("../../generated/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dayjs_1 = __importDefault(require("dayjs"));
const mailer_1 = require("../utils/mailer");
const prisma = new prisma_1.PrismaClient();
class AuthService {
    // ------------------ REGISTER ------------------
    static async registerUser(name, email, password, phone, role = "CUSTOMER") {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            if (!existingUser.isVerified) {
                const code = await this.generateOtp(existingUser.id);
                await (0, mailer_1.sendOtPEmail)(existingUser.email, code);
                const token = jsonwebtoken_1.default.sign({ userId: existingUser.id, role: existingUser.role }, process.env.JWT_SECRET, { expiresIn: "15m" });
                return { user: existingUser, token };
            }
            throw new Error("Email already in use");
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                phone,
                role,
                isVerified: false,
            },
        });
        if (role === "VENDOR") {
            await prisma.restaurant.create({
                data: {
                    name,
                    email,
                    phone,
                    address: "",
                    ownerId: user.id,
                    deliveryTime: "30-40 mins",
                    deliveryFee: 0,
                    minimumOrder: 0,
                    isOpen: false,
                },
            });
        }
        const code = await this.generateOtp(user.id);
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "15m" });
        await (0, mailer_1.sendOtPEmail)(user.email, code);
        return { user, token };
    }
    // ------------------ LOGIN ------------------
    static async login(email, password) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
            throw new Error("Invalid email address");
        const isValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isValid)
            throw new Error("Invalid password");
        if (!user.isVerified) {
            throw new Error("Please verify your account with the OTP first.");
        }
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
        return { token, user };
    }
    // ------------------ OTP UTILS ------------------
    static async generateOtp(userId) {
        const code = (0, crypto_1.randomInt)(100000, 999999).toString();
        const expiresAt = (0, dayjs_1.default)().add(10, "minute").toDate();
        await prisma.otp.create({
            data: { code, userId, expiresAt },
        });
        return code;
    }
    // ------------------ VERIFY OTP (SIGNUP) ------------------
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
                throw new Error("Invalid or expired OTP");
            await prisma.otp.update({
                where: { id: otp.id },
                data: { used: true },
            });
            const user = await prisma.user.update({
                where: { id: payload.userId },
                data: { isVerified: true },
            });
            return {
                message: "Account Verified Successfully",
                user: { id: user.id, email: user.email, role: user.role },
            };
        }
        catch {
            throw new Error("Invalid or expired token");
        }
    }
    // ------------------ FORGOT PASSWORD ------------------
    static async forgotPassword(email) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new Error("If account exists, OTP will be sent");
        }
        const code = (0, crypto_1.randomInt)(100000, 999999).toString();
        const expiresAt = (0, dayjs_1.default)().add(10, "minute").toDate();
        await prisma.otp.create({
            data: { code, userId: user.id, expiresAt },
        });
        await (0, mailer_1.sendOtPEmail)(user.email, code);
        const token = jsonwebtoken_1.default.sign({ userId: user.id, purpose: "RESET_PASSWORD" }, process.env.JWT_SECRET, { expiresIn: "15m" });
        return { message: "OTP sent to email", token };
    }
    // ------------------ VERIFY FORGOT PASSWORD OTP ------------------
    static async verifyForgotPasswordOtp(token, code) {
        try {
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            if (payload.purpose !== "RESET_PASSWORD") {
                throw new Error("Invalid token purpose");
            }
            const otp = await prisma.otp.findFirst({
                where: {
                    userId: payload.userId,
                    code,
                    used: false,
                    expiresAt: { gt: new Date() },
                },
            });
            if (!otp)
                throw new Error("Invalid or expired OTP");
            await prisma.otp.update({
                where: { id: otp.id },
                data: { used: true },
            });
            const resetToken = jsonwebtoken_1.default.sign({ userId: payload.userId, purpose: "RESET_PASSWORD_FINAL" }, process.env.JWT_SECRET, { expiresIn: "15m" });
            return { message: "OTP Verified. Use reset token.", resetToken };
        }
        catch {
            throw new Error("Invalid or expired OTP");
        }
    }
    // ------------------ RESET PASSWORD ------------------
    static async resetPassword(resetToken, newPassword) {
        try {
            const payload = jsonwebtoken_1.default.verify(resetToken, process.env.JWT_SECRET);
            if (payload.purpose !== "RESET_PASSWORD_FINAL") {
                throw new Error("Invalid token purpose");
            }
            const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
            await prisma.user.update({
                where: { id: payload.userId },
                data: { password: hashedPassword },
            });
            return { message: "Password reset successful" };
        }
        catch {
            throw new Error("Invalid or expired reset token");
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map