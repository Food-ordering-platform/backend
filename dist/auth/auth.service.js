"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const prisma_1 = require("../../generated/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dayjs_1 = __importDefault(require("dayjs"));
const mailer_1 = require("../utils/mailer");
const prisma = new prisma_1.PrismaClient();
class AuthService {
    // Register a new User
    static async register(name, email, password, phone) {
        // check if the user exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new Error("Email already in use");
        }
        // hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // create new user
        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                phone,
                role: "CUSTOMER",
                isVerified: false
            },
        });
        //generate otp
        const code = await this.generateOtp(user.id);
        //Generate short-lived JWT 
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: "15m"
        });
        //Log the token to the broswer for now
        await (0, mailer_1.sendOtPEmail)(user.email, code);
        return { user, token };
    }
    //Login User
    static async login(email, password) {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new Error("Invalid email address");
        }
        const isValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isValid) {
            throw new Error("Invalid Password");
        }
        //Generate JWT
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
        return { token, user };
    }
    //Generate OTP
    static async generateOtp(userId) {
        const code = (0, crypto_1.randomInt)(100000, 999999).toString();
        const expiresAt = (0, dayjs_1.default)().add(10, "minute").toDate();
        await prisma.otp.create({
            data: { code, userId, expiresAt }
        });
        return code;
    }
    //Verify OTP
    static async verifyOtp(token, code) {
        try {
            // decode token
            const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            const otp = await prisma.otp.findFirst({
                where: { userId: payload.userId, code, used: false, expiresAt: { gt: new Date() } },
            });
            if (!otp)
                throw new Error("Invalid or expired OTP");
            // mark otp as used
            await prisma.otp.update({
                where: { id: otp.id },
                data: { used: true },
            });
            // mark user as verified
            await prisma.user.update({
                where: { id: payload.userId },
                data: { isVerified: true },
            });
            return { message: "Account Verified Successfully" };
        }
        catch (err) {
            throw new Error("Invalid or expired token");
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map