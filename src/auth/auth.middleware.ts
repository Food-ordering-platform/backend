import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client"; // Adjust path to your generated client

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
        select: { id: true, role: true, email: true, isVerified: true , isEmailVerified: true}
    });

    if (!user) {
        return res.status(401).json({ success: false, message: "User no longer exists." });
    }

   if (!user.isEmailVerified) {
        return res.status(403).json({ success: false, message: "Email not verified. Please verify OTP." });
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

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Ensure the user object exists (meaning authMiddleware ran successfully)
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized. Please login first." 
      });
    }

    // 2. Check if the user's role is in the list of allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `Access denied. Requires one of: ${allowedRoles.join(", ")}` 
      });
    }

    // 3. User is authorized, proceed to the controller
    next();
  };
}