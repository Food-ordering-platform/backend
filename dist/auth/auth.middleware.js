"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../../generated/prisma"); // Adjust path to your generated client
const prisma = new prisma_1.PrismaClient();
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, message: "No token provided. Please login." });
        }
        const token = authHeader.split(" ")[1];
        // 1. Verify Signature
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded.userId;
        // 2. 🛡️ SECURITY CHECK: Does this user actually exist and are they verified?
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, email: true, isVerified: true }
        });
        if (!user) {
            return res.status(401).json({ success: false, message: "User no longer exists." });
        }
        if (!user.isVerified) {
            return res.status(403).json({ success: false, message: "Account not verified. Please verify OTP." });
        }
        // 3. Attach User to Request
        req.user = {
            id: user.id,
            role: user.role,
            email: user.email
        };
        next();
    }
    catch (error) {
        return res.status(401).json({ success: false, message: "Invalid or expired token." });
    }
};
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=auth.middleware.js.map