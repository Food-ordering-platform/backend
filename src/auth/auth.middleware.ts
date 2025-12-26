import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// 1. Extend the Express Request type to include our User object
// This tells TypeScript: "It's okay, req.user exists!"
declare global {
  namespace Express {
    interface Request {
      user?: { 
        id: string; 
        role: string; 
        email: string;
      };
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    // =========================================================
    // CHECK 1: WEB SESSION (The Cookie Pocket)
    // =========================================================
    // If the user is on the Website, the browser sends a Cookie.
    // 'express-session' unlocks it and puts the data in req.session.user
    if (req.session && (req.session as any).user) {
      console.log("✅ Auth: Valid Session Found");
      
      // We copy the user from the Session into req.user
      req.user = (req.session as any).user;
      
      return next(); // <--- SUCCESS! Go to the next function (Controller)
    }

    // =========================================================
    // CHECK 2: MOBILE TOKEN (The JWT Pocket)
    // =========================================================
    // If the user is on the Mobile App, they send a "Bearer <token>" header.
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      
      try {
        // Verify the "Signature" of the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
        
        console.log("✅ Auth: Valid Mobile Token Found");

        // We copy the user from the Token into req.user
        req.user = {
          id: decoded.id || decoded.userId, // Handle potential naming differences
          role: decoded.role,
          email: decoded.email
        };

        return next(); // <--- SUCCESS! Go to the next function (Controller)

      } catch (tokenError) {
        console.warn("⚠️ Auth: Token Invalid/Expired");
        // Don't return here yet, let it fall through to the "Stop" block
      }
    }

    // =========================================================
    // CHECK 3: THE "STOP" GUARD (Critical for preventing 500 Errors)
    // =========================================================
    // If we reach this line, it means:
    // 1. No Session Cookie was found.
    // 2. No valid Bearer Token was found.
    
    console.error("❌ Auth Failed: No credentials provided");
    
    // STOP THE REQUEST HERE. 
    // Do NOT call next(). 
    // Send a 401 (Unauthorized) response immediately.
    return res.status(401).json({ 
      success: false, 
      message: "Unauthorized. Please login to continue." 
    });

  } catch (error) {
    console.error("🔥 Auth Middleware Error:", error);
    return res.status(401).json({ 
      success: false, 
      message: "Authentication failed" 
    });
  }
};