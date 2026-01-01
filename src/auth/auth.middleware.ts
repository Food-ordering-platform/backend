import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "../../generated/prisma"; // Adjust path to your generated client

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided. Please login." });
    }

    const token = authHeader.split(" ")[1];
    
    // 1. Verify Signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
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
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid or expired token." });
  }
};