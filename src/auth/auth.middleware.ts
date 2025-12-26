import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; role: string };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // ---------------------------------------------------------
    // POCKET 1: CHECK SESSION (Web Users)
    // ---------------------------------------------------------
    // If the browser sent a cookie, express-session parsed it into req.session.user
    if (req.session && (req.session as any).user) {
      req.user = { 
        userId: (req.session as any).user.id, 
        role: (req.session as any).user.role 
      };
      return next(); // Pass!
    }

    // ---------------------------------------------------------
    // POCKET 2: CHECK TOKEN (Mobile Users)
    // ---------------------------------------------------------
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      
      // Verify Token
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string; role: string };

      // Attach user to request object
      req.user = decoded;
      return next(); // Pass!
    }

    // ---------------------------------------------------------
    // NO PASS FOUND
    // ---------------------------------------------------------
    return res.status(401).json({ 
      success: false, 
      message: "Unauthorized. Please login." 
    });

  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: "Invalid or expired session/token" 
    });
  }
};