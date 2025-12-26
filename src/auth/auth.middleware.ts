// food-ordering-platform/backend/backend-main/src/auth/auth.middleware.ts

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; email: string };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ 
        success: false, 
        message: "No token provided. Please login." 
      });
    }

    const token = authHeader.split(" ")[1];
    
    // Verify Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    req.user = {
      id: decoded.id || decoded.userId, // Handle different payload keys if any
      role: decoded.role,
      email: decoded.email
    };

    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid or expired token. Please login again." 
    });
  }
};